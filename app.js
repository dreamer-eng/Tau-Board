const express = require('express');
const fs = require('fs');
const md5 = require('md5');
const db = require('./databasepg');
const port = process.env.PORT || 3000;
const session = require('express-session');
const store = new session.MemoryStore();
const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false });

const app = express();
const router = express.Router();


app.use(session(
{
    secret: 'Your key',
    cookie: {maxAge: 1000 * 60 * 60 },
    saveUninitialized: false,
    store:store
}));


app.set('view engine', 'hbs');
app.use(bodyParser.json());
app.use(urlencodedParser);


app.get('/', (req, res) => 
{
    if (req.session.authenticated) 
    {
        res.redirect('list');
    }
    else
    {
        res.render('index');
    }

});

app.get('/logout', (req,res)=>{
    req.session.destroy();
    res.redirect('/');
});

app.get('/aboutsite', (req, res) => {
    if (req.session.authenticated) 
    {
        res.render('aboutsite');
    }
    else
    {
        res.redirect('/');
    }
});



app.post('/login', (req, res) =>
{
    if (req.session.authenticated) 
    {
        res.redirect('list');
    }
    else
    {
        var email = req.body.email;
        var password = md5(req.body.password);

        db.pool.query("SELECT * FROM users WHERE email=$1 AND password=$2", [email, password],
            (err, resp) => 
            {
                if (resp.rows.length > 0)
                {
                    req.session.authenticated = true;
                    var id = resp.rows[0].id;
                    req.session.user = {
                       id
                    };
                    res.redirect('list');
                    
                }
                else 
                {
                    res.redirect('/');
                }
            })
    }

});

app.get('/img/background', (req,res)=>{
    var img = fs.readFileSync('./views/doodles.png');
    res.writeHead(200, {'Content-Type': 'image/gif' });
    res.end(img, 'binary');
});

app.get('/styles/main',(req,res)=>{
    var style = fs.readFileSync('./styles/main.css');
    res.writeHead(200, {'Content-Type':'text/css'});
    res.end(style,'binary')
});

app.get('/styles/list',(req,res)=>{
    var style = fs.readFileSync('./styles/list.css');
    res.writeHead(200, {'Content-Type':'text/css'});
    res.end(style,'binary')
});

app.get('/register', (req, res) => 
{
    if(req.session.authenticated)
    {
        res.redirect('list');
    }
    else
    {
        if (req.query.m == '') 
        {
            res.render('register',
                { mErr: 'An account with this e-mail already exists !' });
        }
        else if (req.query.l == '') 
        {
            res.render('register',
                { pErr: 'The password must be at least 8 characters long !' });
        }
        else if (req.query.p == '') 
        {
            res.render('register', { pErr: 'Passwords do not match !' });
        }
        else 
        {
            res.render('register');
        }
    }
});

app.post('/register', (req, res) => 
{
    if(req.session.authenticated)
    {
        res.redirect('list');
    }
    else
    {
        if (req.body.password.length > 7) 
        {
            if (req.body.password == req.body.rpassword) 
            {
                db.pool.query("SELECT id FROM users WHERE email=$1", [req.body.email], (err, resp) => 
                {
                    if (resp.rows.length == 0) {
                        var password = md5(req.body.password);
                        db.pool.query("INSERT INTO users (email,password) VALUES ($1,$2)", [req.body.email, password], (err, resp) => 
                        {
                            if (!err) 
                            {
                                return res.render('registered');
                            }
                            else
                            {
                                return res.status(500).send({message:"There is something wrong with our server. Sorry :("});
                            }
                        });

                    }
                    else 
                    {
                        res.redirect('/register?m');
                    }
                })
            }
            else 
            {
                res.redirect('/register?p');
            }
        }
        else 
        {
            res.redirect('/register?l');
        }
    }

});

app.get('/list', (req,res)=>
{
    if(req.session.authenticated)
    {
        res.render('list');
    }
    else
    {
        res.redirect('/');
    }
});

app.get('/project', async (req,res)=>{
    if(req.session.authenticated && req.query.id)
    {
        res.render('project',{projectID:req.query.id});
    }
    else
    {
        res.redirect('/');
    }
});

router.use((req, res, next)=>{
    if(req.session.authenticated)
    {
        next();
    }
    else
    {
        res.status(401).send({msg:'fuck you hacker :)'});
    }
});

router.get('/todolists',(req,res)=>{

        if(req.query.id)
        {
            db.pool.query("SELECT * FROM lists WHERE id_user=$1 AND id =$2",[req.session.user.id,req.query.id],(err,resp)=>{
                if(!err)
                {
                    res.status(200).send(JSON.stringify(resp.rows));
                }
                else
                {
                    res.status(500).send({message:"There is something wrong with our server. Sorry :("});
                }
            });
        }
        else
        {
 
            db.pool.query("SELECT projectName,id FROM lists WHERE id_user=$1 ORDER BY id DESC", [req.session.user.id],(err,resp)=>{
                
                if(!err)
                {
                    res.status(200).send(JSON.stringify(resp.rows));
                } 
                else
                {
                    console.log(err);
                    return res.status(500).send({message:"There is something wrong with our server. Sorry :("});
                }
        });


            
        }
});

router.post('/todolists', async (req,res)=>{
    
    
    if(req.body.newName)
    {
        var nProjectName = req.body.newName;
        
        var notExistProject = async () => {
            let result;
            let resp = await db.pool.query('SELECT id FROM lists WHERE projectname=$1 AND id_user=$2', [nProjectName,req.session.user.id]);
            if(resp.rows.length <1)
            {
                result = true;
            }
            else
            {
                result = false;
            }
            
            return result;
        };

        if(notExistProject())
        {
            db.pool.query('INSERT INTO lists (id_user,projectname,context) VALUES ($1,$2,$3)', [req.session.user.id, nProjectName, ''], (err,resp)=>{
                if(err)
                {
                    res.status(500).send(); //Internal Server Error
                }
                else
                {
                    res.status(201).send(); // Created

                }
            });
        }
        else
        {
            res.status()
        }
    }
    else if(req.body.id && req.body.context)
    {
        db.pool.query('UPDATE lists SET context=$1 WHERE id=$2 AND id_user=$3', [req.body.context, req.body.id ,req.session.user.id], (err,resp)=> {
            if(err)
            {
                console.log(err);
                res.status(304).send(); //Internal Server Error 
            }
            else
            {
                res.status(200).send(); // Update
            }

        });
    }
    else
    {
        res.status(400).send(); // Bad request
    }
});

router.delete('/todolists', async (req,res)=> {

        let resp = await db.pool.query('SELECT projectname FROM lists WHERE id=$1 AND id_user=$2', [req.body.pid, req.session.user.id]);
        if(resp.rows.length > 0)
        {
            db.pool.query('DELETE FROM lists WHERE id=$1',[req.body.pid], ()=> {
                res.status(200).send();
            });
            
        }
        else
        {
            res.status(400).send();
        }
       
        


});

app.use('/api', router);
app.listen(port);
