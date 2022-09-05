import express, { response } from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from "dotenv";
import joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();

const server = express();
server.use(cors());
server.use(express.json());

//Schemas 

const userSchema = joi.object({
    name: joi.string().required()
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required(),
})

// database configuration

const mongoClient = new MongoClient(process.env.MONGO_URL);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db("batepapo-uol");
});


// end points

server.get('/', async (request, response) => {
    response.send("Rodando api de buenas!");
});

server.get('/participants', async (request, response) => {
    try {
        const users = await db.collection("user").find().toArray();
        response.send(users);

    } catch (error) {
        response.send(error);
    }
});

server.post('/participants', async (request, response) => {
    const user = request.body;
    const validation = userSchema.validate(user, { abortEarly: true });
    const findPartcipant = await db.collection("user").findOne({ name: user.name });
    let time = Date.now();

    if (validation.error) {
        return response.sendStatus(422);
    }

    try {
        if (findPartcipant === null) {
            await db.collection("user").insertOne({
                name: user.name,
                lastStatus: time
            });

            await db.collection("messages").insertOne({
                from: user.name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: dayjs().locale('pt-br').format('hh:mm:ss')
            });

            response.sendStatus(200);

        } else {
            response.sendStatus(409);
        }

    } catch (error) {
        response.sendStatus(500);
    }
});

server.get('/messages', async (request, response) => {
    const { user } = request.headers;
    const limit = parseInt(request.query.limit);
    const messages = await db.collection("messages").find().toArray();

    try {
        const messagesFilter = messages.filter(message => message.to === user || message.from === user || message.to == 'Todos');
        
        if(!limit){
            response.send(messagesFilter);
        } else if(messagesFilter < limit){
            response.send(messagesFilter);
        } else {
            const limitedMessages = await messagesFilter.splice(-{ limit });
            response.send(limitedMessages);
        }
       

    } catch (error) {
        response.send(error);
    }
});

server.post('/messages', async (request, response) => {
    const { to, text, type } = request.body;
    const message = request.body;
    const { user } = request.headers;
    const validation = messageSchema.validate(message, { abortEarly: true });

    if(validation.error){
        return response.sendStatus(422);
    }

    try {
        const participant = await db.collection("user").findOne({
            name: user
        });

        if (!participant) {
            console.log(participant);
            return response.sendStatus(422);
            
        }

        await db.collection("messages").insertOne({
            to: to,
            text: text,
            type: type,
            from: user,
            time: dayjs().format('hh:mm:ss')
        });

        response.sendStatus(200);

    } catch (error) {
        response.sendStatus(500);
    }

});

server.post('/status', async (request, response) => {
    const {user} = request.headers;
    const updateUser = await db.collection("user").findOne({name: user});

    try {
        if(updateUser){
            await db.collection("user").updateOne({name: user}, { $set: { lastStatus: Date.now() }});
            response.sendStatus(200);
        } else {
            response.sendStatus(404);
        }
    } catch (error) {
        response.sendStatus(500);
    }
});

// Método que verifica a atividade do usuário no bate papo

const TIMER = 15000;

setInterval(async () => {
    const users = await db.collection("user").find().toArray();
    const now = Date.now();

    try {
        let verifyActivity = users.filter(user => (now - user.lastStatus) >= TIMER);
        verifyActivity.map(user => {

            db.collection("user").deleteOne({
                name: user.name
            });

            db.collection("messages").insertOne({
                from: user.name, 
                to: 'Todos', 
                text: 'sai da sala...', 
                type: 'status',
                time: dayjs().format('hh:mm:ss')
            });
        });

    } catch (error) {
        response.sendStatus(500);
    }

}, 3000);
    
server.listen(5000);
