const express = require('express');
const session = require('express-session');
require('dotenv').config();
const app = express();
const PORT = 3000;
const bcrypt = require('bcrypt');
const passport = require('./passportConfig');
const db = require('./db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//configuro la sessione
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

//inizializzo Passport e le sessioni
app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Non sei autenticato' });
}

//endpoint per la registrazione
//
app.post('/registrati', async(req,res)=>{
    try{
        const {username, password, email, indirizzo} = req.body;

        //controllo se l'username o la mail inseriti esistono già
        const userExist = await db.query('SELECT * FROM utenti WHERE username = $1 OR email = $2',[username,email]);
        if(userExist.rows.length > 0){
            console.error("Username o email già utilizzati. Riprovare");
            return res.status(400).json({error: "Username o email già utilizzati. Riprovare"});
        }
        //criptare password
        const salt = await bcrypt.genSalt(10);
        const hashPass = await bcrypt.hash(password,salt);
        
        //inserisco utente nel database e creo carrello corrispondente
        const registerUser = await db.query("INSERT INTO utenti (username, password, email, indirizzo) VALUES($1, $2, $3, $4) RETURNING id",
                                             [username, hashPass, email, indirizzo]);
        if(registerUser.rowCount > 0){
            const userId = registerUser.rows[0].id;
            await db.query("INSERT INTO carrelli (id_utente) VALUES($1)",[userId]);
            
            // Rispondo con successo
            res.json({ message: "Registrazione avvenuta con successo!" });
        }else {
            res.status(500).json({ error: "Errore nella registrazione dell'utente" });
        };

    }catch(errore){
        console.error("Errore nella query:", errore);
        res.status(500).send("Errore nel server");
    }
});

//endpoint per il login
//
app.post('/login', async(req,res,next)=>{
    passport.authenticate('local', (err,user,info)=>{
        
        if(err) return next(err);
        
        if(!user){
            return res.status(401).json({message:info.message});
        }

        req.login(user, (err)=>{
            if(err) return next(err);
            return res.json({message: 'Login avvenuto con successo', user:{id: user.id, username: user.username}});
        });
    })(req,res,next);
});

//endpoint per il logout
//
app.post('/logout', async(req,res)=>{
    req.logout((err)=>{
        if(err) return res.status(500).json({message:"Errore durante il logout"});
        res.json({message:"Logout avvenuto con successo"});
    })
});

// endpoint per le richieste sulla tabella prodotti
//
app.get('/prodotti', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM prodotti');  
      res.json(result.rows);
    } catch (error) {
      console.error('Errore nella query:', error);
      res.status(500).send('Errore nel server');
    }
});

app.get('/prodotti/:id', async (req, res) => {
    try {
      const result = await db.query(`SELECT * FROM prodotti WHERE id = $1`,[req.params.id]);  
      res.json(result.rows);
    } catch (error) {
      console.error('Errore nella query:', error);
      res.status(500).send('Errore nel server');
    }
});

//endpoint per le richieste sulla tabella utenti
//
app.get('/utenti/:id',ensureAuthenticated, async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM utenti WHERE id = $1`,[req.params.id]);  
        res.json(result.rows);
    } catch (error) {
        console.error('Errore nella query:', error);
        res.status(500).send('Errore nel server');
    }
});

app.put('/utenti/:id',ensureAuthenticated, async(req,res)=>{
    try{
        const {username, password, email, indirizzo} = req.body;

        //controllo se l'utente ha modificato l'username
        const currentUser = await db.query(`SELECT username FROM utenti WHERE id=$1`,[req.params.id]);
        
        //se ha modificato l'username controllo che quello nuovo non esista già
        if(username !== currentUser.rows[0].username){
            const checkUser = await db.query(`SELECT id FROM utenti WHERE username = $1`,[username]);
            
            if(checkUser.rows.length > 0){
                return res.status(400).json({error:"Username già in uso"});
            }
        }
        const result = await db.query(`UPDATE utenti SET
                                         username = $1,
                                         password = $2,
                                         email = $3,
                                         indirizzo = $4 WHERE id = $5`,[username, password, email, indirizzo, req.params.id]);
        res.json(result.rows);
    }catch (error){
        console.error('Errore nella query:',error);
        res.status(500).send('Errore nel server');
    }
});

//endpoint per le richieste sulla tabella carrello
app.get('/carrello/:user',ensureAuthenticated, async (req, res) => {
    try {
        //trovo l'id del carrello corrispondente all'utente
        const carrello = await db.query(`SELECT id FROM carrelli WHERE id_utente = $1`,[req.params.user]);
        if(carrello.rows.length === 0){
            return res.status(400).json({error:"Utente non trovato"});
        }
        const id_carrello = carrello.rows[0].id;
        const result = await db.query(`SELECT * FROM carrelli_dett WHERE id_carrello = $1`, [id_carrello]);  
        res.json(result.rows);
    } catch (error) {
        console.error('Errore nella query:', error);
        res.status(500).send('Errore nel server');
    }
});

app.post('/carrello/:user',ensureAuthenticated, async(req,res)=>{
    try{
        const {id_prodotto, quantita} = req.body;

        // Verifico che i parametri obbligatori siano presenti
        if (!id_prodotto || !quantita) {
            return res.status(400).json({ error: "Parametri mancanti: id_prodotto e quantita sono obbligatori" });
        }

        //trovo l'id del carrello corrispondente all'utente
        const carrello = await db.query(`SELECT id FROM carrelli WHERE id_utente = $1`,[req.params.user]);
        if(carrello.rows.length === 0){
            return res.status(400).json({error:"Utente non trovato"});
        }
        const id_carrello = carrello.rows[0].id;
        await db.query(`INSERT INTO carrelli_dett (id_carrello, id_prodotto, quantita) 
                                         VALUES ($1, $2, $3)`,[id_carrello, id_prodotto,quantita]);
        res.status(201).json({message:"Prodotto inserito correttamente"});
    }catch(error){
        console.error("Errore nella query:",error);
        res.status(500).send('Errore nel server');
    }
});

//endpoint per le richieste sulla tabella ordini
app.get('/ordini/:user',ensureAuthenticated, async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM ordini WHERE id_utente = $1`, [req.params.user]);  
        res.json(result.rows);
    } catch (error) {
        console.error('Errore nella query:', error);
        res.status(500).send('Errore nel server');
    }
});

app.get('/ordini/:user/:id',ensureAuthenticated, async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM ordini_dett WHERE id_ordine = $1`, [req.params.id]); 
        res.json(result.rows);
    } catch (error) {
        console.error('Errore nella query:', error);
        res.status(500).send('Errore nel server');
    }
});

//endpoint checkout del carrello, creazione ordine, svuoto il carrello
//
app.post('/carrello/:user/checkout',ensureAuthenticated, async (req, res) => {
    try {
        const { metodo_pagamento, dettagli_pagamento } = req.body;

        // Validazione del carrello
        const carrello = await db.query(
            "SELECT c.id, cd.id_prodotto, cd.quantita, p.prezzo FROM carrelli c " +
            "JOIN carrelli_dett cd ON c.id = cd.id_carrello " +
            "JOIN prodotti p ON cd.id_prodotto = p.id " +
            "WHERE c.id_utente = $1", 
            [req.params.user]
        );

        if (carrello.rows.length === 0) {
            return res.status(404).json({ error: "Carrello non trovato o vuoto" });
        }

        // Calcolo del totale
        let totale_ordine = 0;
        carrello.rows.forEach(item => {
            //trasformo il prezzo in un numero utilizzabile
            const costo_num = parseFloat(item.prezzo
                                                    .replace(/[^\d,.-]/g, '')
                                                    .replace(/\./g, '') 
                                                    .replace(',', '.'));
            totale_ordine +=  costo_num * item.quantita;
        });

        // Simulazione del pagamento
        if (!metodo_pagamento || !dettagli_pagamento) {
            return res.status(400).json({ error: "Dettagli di pagamento mancanti" });
        }

        // In questo momento assumiamo che il pagamento vada sempre a buon fine
        const pagamento_risultato = { successo: true };

        if (!pagamento_risultato.successo) {
            return res.status(500).json({ error: "Pagamento fallito. Riprova più tardi." });
        }

        // Creazione dell'ordine
        const ordine = await db.query(
            `INSERT INTO ordini (id_utente, totale_ordine, stato) 
             VALUES ($1, $2, 'pagato') RETURNING id`,
            [req.params.user, totale_ordine]
        );

        if (ordine.rows.length === 0) {
            return res.status(500).json({ error: "Errore durante la creazione dell'ordine" });
        }

        const ordine_id = ordine.rows[0].id;

        // Creazione dei dettagli dell'ordine
        const dettagliOrdine = carrello.rows.map(item => [ordine_id, item.id_prodotto, item.quantita]);

        const dettagliQuery = `
            INSERT INTO ordini_dett (id_ordine, id_prodotto, quantita) 
            VALUES ($1, $2, $3)`;

        for (let dettaglio of dettagliOrdine) {
            await db.query(dettagliQuery, dettaglio);
        }

        // Svuotamento del carrello
        await db.query("DELETE FROM carrelli_dett WHERE id_carrello = $1", [carrello.rows[0].id]);

        res.status(201).json({ message: "Pagamento riuscito e ordine creato", ordine_id });

    } catch (error) {
        console.error("Errore durante il checkout:", error);
        res.status(500).json({ error: "Errore durante il checkout" });
    }
});

//connessione al server
app.listen(PORT, ()=>{
    console.log(`Server listen on port: ${PORT}`)
})