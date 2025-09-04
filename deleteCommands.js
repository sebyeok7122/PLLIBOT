const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require('dotenv').config();

const token = process.env.PLLIBOT_TOKEN;
const clientId = '1394568154247856178';
const guildId = '1363783536443920444';

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    console.log('⛏ 슬래시 명령어 삭제 중...');
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: [] }
    );
    console.log('✅ 슬래시 명령어 전부 삭제 완료!');
  } catch (error) {
    console.error('🚨 삭제 중 오류:', error);
  }
})();
