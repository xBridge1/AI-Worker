const http = require('http');
const WebSocket = require('ws');
const amqp = require('amqplib');

const PORT = process.env.PORT || 8080;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

server.listen(PORT, () => {
    console.log("Servidor rodando na porta", PORT);
});

let clients = {};
let channel;

wss.on('connection', (ws) => {

	ws.on('message', async (msg) => {
		const data = JSON.parse(msg);

		if (data.type === "auth") {
			if (!clients[data.user_id]) {
				clients[data.user_id] = new Set();
			}

			clients[data.user_id].add(ws);
			ws.user_id = data.user_id;

			console.log("Cliente conectado:", data.user_id);
			return;
		}

		if (data.type === "message") {
			
			if (!channel) {
				console.log("Rabbit ainda não pronto");
				return;
			}
			
			if (!data.request_id) {
				data.request_id = Date.now() + "-" + Math.random();
			}

			channel.sendToQueue('chat_requests', Buffer.from(JSON.stringify({
				user_id: data.user_id,
				request_id: data.request_id,
				message: data.message,
				history: data.history || []
			})));

			console.log("Enviado pro Rabbit:", data.message);
		}
	});

    ws.on('close', () => {
        if (ws.user_id && clients[ws.user_id]) {
            clients[ws.user_id].delete(ws);

            if (clients[ws.user_id].size === 0) {
                delete clients[ws.user_id];
            }
        }
    });
});

async function start() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    console.log("URL:", process.env.RABBITMQ_URL);
	channel = await conn.createChannel();

	await channel.assertQueue('chat_requests');
	await channel.assertQueue('chat_responses');
	

    console.log("Worker rodando...");

    channel.consume('chat_requests', async (msg) => {
        const data = JSON.parse(msg.content.toString());

        console.log("Recebido:", data.message);
		

        const response = "Resposta da IA: " + data.message;
		
		const response = gerarRespostaFake(data.message);
		
		channel.sendToQueue('chat_responses', Buffer.from(JSON.stringify({
			user_id: data.user_id,
			request_id: data.request_id,
			response: response
		})));

        channel.ack(msg);
    });

    channel.consume('chat_responses', (msg) => {
        const data = JSON.parse(msg.content.toString());

		const userSockets = clients[data.user_id];

		if (userSockets) {
			userSockets.forEach(ws => {
				ws.send(JSON.stringify({
					type: "response",
					request_id: data.request_id,
					message: data.response
				}));
			});
		}

        channel.ack(msg);
    });
}

function gerarRespostaFake(msg) {
    if (msg.includes("oi")) return "Olá! Sou a calliope sua agente de IA pessoal posso ajudar?";
    if (msg.includes("rabbit")) return "RabbitMQ é um message broker.";
    return "Entendi: " + msg;
}


start();
