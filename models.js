const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('reel-it-commerce', 'root', null, {
    host: '127.0.0.1',
    dialect: 'mysql'
});

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

module.exports = { sequelize, Chat, ChatUser, ChatMessage };
