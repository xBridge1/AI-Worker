const amqp = require('amqplib');

async function send() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const ch = await conn.createChannel();

    await ch.assertQueue('chat_requests');

    const msg = {
        user_id: 1,
        message: "Teste do sistema 🔥"
    };

    ch.sendToQueue('chat_requests', Buffer.from(JSON.stringify(msg)));

    console.log("Mensagem enviada!");

    setTimeout(() => {
        conn.close();
    }, 500);
}

send();