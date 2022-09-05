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
    type: joi.string().valid('message','private_message').required(),
    from: joi.string().required(),
    time: joi.optional()
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

    console.log(findPartcipant);

    if(validation.error){
        response.sendStatus(422);
        return;
    }
        
    try {
        if(findPartcipant === null){
            await db.collection("user").insertOne({
                name: user.name, 
                lastStatus: time
            });

            await db.collection("messages").insertOne({
                from: user.name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: dayjs.locale('pt-br').format('hh:mm:ss')
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
    try {
        const messages = await db.collection("messages").find().toArray();
        response.send(messages);
        
    } catch (error) {
        response.send(error);
    }
});

server.post('/messages', async (request, response) => {

});

server.get('/status', async (request, response) => {

});

server.listen(5000);
