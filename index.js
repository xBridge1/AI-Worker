const WebSocket = require('ws');
const amqp = require('amqplib');

const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });

let clients = {};

wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        clients[data.user_id] = ws;
        console.log("Cliente conectado:", data.user_id);
    });
});

async function start() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const ch = await conn.createChannel();

    await ch.assertQueue('chat_requests');
    await ch.assertQueue('chat_responses');

    console.log("Worker rodando...");

    ch.consume('chat_requests', async (msg) => {
        const data = JSON.parse(msg.content.toString());

        console.log("Recebido:", data.message);

        const response = "Resposta da IA: " + data.message;

        ch.sendToQueue('chat_responses', Buffer.from(JSON.stringify({
            user_id: data.user_id,
            response: response
        })));

        ch.ack(msg);
    });

    ch.consume('chat_responses', (msg) => {
        const data = JSON.parse(msg.content.toString());

        const ws = clients[data.user_id];

        if (ws) {
            ws.send(JSON.stringify({
                message: data.response
            }));
        }

        ch.ack(msg);
    });
}

start();