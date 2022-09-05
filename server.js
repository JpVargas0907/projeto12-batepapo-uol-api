import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from "dotenv";
import joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();

const server = express();
server.use(cors());
server.use(express.json());

const userSchema = joi.object({
    name: joi.string().required()
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required(),
})

// database config 

const mongoClient = new MongoClient(process.env.MONGO_URL);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db("batepapo-uol");
});

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

server.get('/messages/?limit', async (request, response) => {
    const { user } = request.headers;
    const messages = await db.collection("messages").find().toArray();
    console.log(user);

    try {
        const messagesFilter = messages.filter(message => message.to === user || message.from === user || message.to == 'Todos');
        response.send(messagesFilter);

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

server.listen(5000);
