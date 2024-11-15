const db = require('./db');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

//definisco la strategia di autenticazione
//
passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
}, async(username, password, done)=>{
    try{
        //cerco l'utente nel database
        const user = await db.query("SELECT * FROM utenti WHERE username = $1",[username]);
        if(user.rows.length === 0){
            return done(null, false, {message: 'Utente non trovato - inserire l\'username corretto'});
        }

        const utente = user.rows[0];
        //controllo password
        const passMatch = await bcrypt.compare(password, utente.password);
        if(!passMatch){
            return done(null, false, {message: 'Inserire la password corretta'});
        }
        return done(null, utente);

    }catch(error){
        return done(error);
    }
}));

//serializzo e deserializzo l'utente
//
passport.serializeUser((utente,done)=>{
    done(null, utente.id);
});

passport.deserializeUser(async(id,done)=>{
    try{
        const utente = await db.query("SELECT * FROM utenti WHERE id = $1",[id]);
        if(utente.rows.length === 0){
            return done(new Error('Utente non trovato'));
        }
        done(null,user.rows[0]);
    }catch(errore){
        done(errore);
    }
})

//esporto la configurazione
module.exports = passport;