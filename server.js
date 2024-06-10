const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*', // Allow requests from any origin
        methods: ['GET', 'POST' , 'PUT'],
        credentials: true,
    }
});

app.use(cors());

app.use(bodyParser.json());

const sequelize = new Sequelize('reel-it-commerce', 'naveed', 'password', {
    host: '127.0.0.1',
    dialect: 'mysql',
});

// Models
const Chat = sequelize.define('Chat', {
    last_message: DataTypes.STRING,
    time: DataTypes.TIME,
    date: DataTypes.DATE,
    read: DataTypes.BOOLEAN
});

const ChatUser = sequelize.define('ChatUser', {
    chat_id: {
        type: DataTypes.INTEGER,
        references: {
            model: Chat,
            key: 'id'
        }
    },
    user_id: DataTypes.INTEGER
});

const ChatMessage = sequelize.define('ChatMessage', {
    sender_id: DataTypes.INTEGER,
    receiver_id: DataTypes.INTEGER,
    message: DataTypes.STRING,
    time: DataTypes.TIME,
    date: DataTypes.DATE
});

Chat.hasMany(ChatMessage, { foreignKey: 'chat_id' });
ChatMessage.belongsTo(Chat, { foreignKey: 'chat_id' });

Chat.sync();
ChatUser.sync();
ChatMessage.sync();

// API Endpoints
app.post('/search-user', async (req, res) => {
    const { username } = req.body;
    const users = await sequelize.query(
        'SELECT * FROM users WHERE name LIKE :username',
        { replacements: { username: `%${username}%` }, type: sequelize.QueryTypes.SELECT }
    );
    res.json(users);
});

app.get('/chat-listing/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const chats = await sequelize.query(
            `SELECT c.*, cu.user_id AS participant_user_id,  u.name AS participant_user_name,u.email AS participant_user_email,cu2.user_id AS requesting_user_id,u2.name AS requesting_user_name,u2.email AS requesting_user_email
            FROM chats c 
            JOIN ChatUser cu ON c.id = cu.chat_id 
            JOIN users u ON cu.user_id = u.id
            LEFT JOIN ChatUser cu2 ON c.id = cu2.chat_id 
            LEFT JOIN users u2 ON cu2.user_id = u2.id 
            WHERE cu2.user_id = :userId
            AND cu.user_id != :userId
            ORDER BY c.date DESC, c.time DESC`,
            { replacements: { userId }, type: sequelize.QueryTypes.SELECT }
        );
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching chat listings.' });
    }
});

app.get('/messages/:chatId', async (req, res) => {
    const { chatId } = req.params;
    const messages = await ChatMessage.findAll({
        where: { chat_id: chatId },
        order: [['date', 'ASC'], ['time', 'ASC']]
    });
    res.json(messages);
});

// Socket.io connections
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`${userId} joined`);
    });

    socket.on('sendMessage', async (data) => {
        const { sender_id, receiver_id, message } = data;
        const time = new Date().toTimeString().split(' ')[0];
        const date = new Date().toISOString().split('T')[0];
        let newChat = false;
        let chat = await sequelize.query(
            `SELECT c.id FROM Chats c 
             JOIN ChatUser cu1 ON c.id = cu1.chat_id 
             JOIN ChatUser cu2 ON c.id = cu2.chat_id 
             WHERE cu1.user_id = :sender_id AND cu2.user_id = :receiver_id`,
            { replacements: { sender_id, receiver_id }, type: sequelize.QueryTypes.SELECT }
        );

        if (!chat.length) {
            chat = await Chat.create({ last_message: message, time, date, read: false });
            await ChatUser.bulkCreate([
                { chat_id: chat.id, user_id: sender_id },
                { chat_id: chat.id, user_id: receiver_id }
            ]);
            newChat = true;
        } else {
            chat = await Chat.findByPk(chat[0].id);
            chat.last_message = message;
            chat.time = time;
            chat.date = date;
            chat.read = false;
            await chat.save();
        }

        const newMessage = await ChatMessage.create({
            sender_id,
            receiver_id,
            message,
            time,
            date,
            chat_id: chat.id,
        });

        console.log(chat.id)
        // Send message only to sender and receiver
        if(newChat){
            io.emit(`new-chat-${sender_id}`,{chat: chat.id , receiver_id :receiver_id })
        }
        io.emit(`receiveMessage-${chat.id}`, newMessage);
        io.emit(`chat-${receiver_id}`, newMessage);
        io.emit(`chat-${sender_id}`, newMessage);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
