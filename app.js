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
app.get('/utenti/:id', async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM utenti WHERE id = $1`,[req.params.id]);  
        res.json(result.rows);
    } catch (error) {
        console.error('Errore nella query:', error);
        res.status(500).send('Errore nel server');
    }
});

app.put('/utenti/:id', async(req,res)=>{
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
app.get('/carrello/:user', async (req, res) => {
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

app.post('/carrello/:user', async(req,res)=>{
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
app.get('/ordini/:user', async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM ordini WHERE id_utente = $1`, [req.params.user]);  
        res.json(result.rows);
    } catch (error) {
        console.error('Errore nella query:', error);
        res.status(500).send('Errore nel server');
    }
});

app.get('/ordini/:user/:id', async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM ordini_dett WHERE id_ordine = $1`, [req.params.id]); 
        res.json(result.rows);
    } catch (error) {
        console.error('Errore nella query:', error);
        res.status(500).send('Errore nel server');
    }
});

app.post('/ordini/:user', async (req,res) =>{
    try{
        const {prodotti} = req.body;
        // Verifico che i parametri obbligatori siano presenti
        if (!prodotti || prodotti.length === 0) {
            return res.status(400).json({ error: "Parametri mancanti: id_prodotto e quantita sono obbligatori" });
        }

        //calcolo il totale dell'ordine
        let totale_ordine = 0;
        for (let prodotto of prodotti){

            const {id_prodotto, quantita} = prodotto;
            
            const costo = await db.query(`SELECT prezzo FROM prodotti WHERE id = $1`,[id_prodotto]);
            if(costo.rows.length !== 0){
                //trasformo il prezzo in un numero utilizzabile
                const costo_num = parseFloat(costo.rows[0].prezzo
                                                                .replace(/[^\d,.-]/g, '')
                                                                .replace(/\./g, '') 
                                                                .replace(',', '.'));
                totale_ordine +=  costo_num * quantita;
            }else{
                return res.status(404).json({error: `Prodotto con id ${id_prodotto} non trovato`});
            }
        }
        //creo l'id dell'ordine 
        const ordine = await db.query(`INSERT INTO ordini (id_utente, totale_ordine, stato) VALUES ($1, $2, 'in preparazione') RETURNING id`,[req.params.user, totale_ordine]);

        const id_ordine = ordine.rows[0].id;

        // Inserisco tutti i prodotti nel dettaglio ordine
        const dettagli = prodotti.map(({ id_prodotto, quantita }) => [id_ordine, id_prodotto, quantita]);
        const values = dettagli.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');

        const flatValues = dettagli.flat();
        await db.query(
            `INSERT INTO ordini_dett (id_ordine, id_prodotto, quantita) 
             VALUES ${values}`,
            flatValues
        );

        res.json({ message: 'Ordine creato con successo', ordine: ordine.rows[0] });
    }catch(error){
        console.error("Errore nella query:",error);
        res.status(500).send('Errore nel server');
    }
});

//connessione al server
app.listen(PORT, ()=>{
    console.log(`Server listen on port: ${PORT}`)
})