const express = require('express');
const app = express();
const PORT = 3000;

const db = require('./db');

app.use(express.json());


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
app.get('/carrello/:id', async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM carrelli_dett WHERE id_carrello = $1`, [req.params.id]);  
        res.json(result.rows);
    } catch (error) {
        console.error('Errore nella query:', error);
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

//connessione al server
app.listen(PORT, ()=>{
    console.log(`Server listen on port: ${PORT}`)
})