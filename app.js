const express = require('express');
const app = express();
const PORT = 3000;

const db = require('./db');

app.use(express.json());

app.get('/utenti', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM utenti');  
      res.json(result.rows);
    } catch (error) {
      console.error('Errore nella query:', error);
      res.status(500).send('Errore nel server');
    }
  });

app.listen(PORT, ()=>{
    console.log(`Server listen on port: ${PORT}`)
})