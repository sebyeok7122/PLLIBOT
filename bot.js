// ✅ PART 1: 기본 설정 + 클라이언트 생성 + 파일 로딩
console.log("✅ 시작됨! 최신 bot.js가 실행되고 있어!");

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require('discord.js');

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ====== DISBOARD 연동 설정/유틸 ======
const DISBOARD_BOT_ID = '302050872383242240';
const PROMO_LIMIT_PER_DAY = 10;
const BUMP_COOLDOWN_MS = 2 * 60 * 60 * 1000;

const promoPath = path.join(__dirname, 'promo.json');
function loadPromo() {
  if (fs.existsSync(promoPath)) return JSON.parse(fs.readFileSync(promoPath, 'utf8'));
  return { daily: {}, lastBumpAt: {} };
}
function savePromo(data) {
  fs.writeFileSync(promoPath, JSON.stringify(data, null, 2));
}

const processedPath = path.join(__dirname, 'promo_processed.json');
function loadProcessed() {
  return fs.existsSync(processedPath) ? JSON.parse(fs.readFileSync(processedPath, 'utf8')) : {};
}
function saveProcessed(d) {
  fs.writeFileSync(processedPath, JSON.stringify(d, null, 2));
}

const PROMO_POINTS = 1;

async function awardPromoPoints(guild, userId, amount, reason = 'DISBOARD bump') {
  const points = loadJSON(pointPath);
  if (!points[userId]) points[userId] = { total: 0, 홍보: {}, 출석: [] };
  points[userId].total += amount;
  saveJSON(pointPath, points);

  try {
    const ch = await guild.channels.fetch(logChannelId).catch(() => null);
    ch?.send(`✅ <@${userId}> 님에게 **${amount}점** 지급 (${reason})`);
  } catch {}
}

const express = require('express');
const app = express();
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// 🔸 온보딩 상태 저장
const onboardingPath = path.join(__dirname, 'onboarding.json');
function loadOnboarding() {
  if (fs.existsSync(onboardingPath)) {
    return JSON.parse(fs.readFileSync(onboardingPath, 'utf8'));
  } else return {};
}
function saveOnboarding(data) {
  fs.writeFileSync(onboardingPath, JSON.stringify(data, null, 2));
}

const token = process.env.PLLIBOT_TOKEN;
const guildId = '1363783536443920444';
const logChannelId = '1394623614967480452';
const onboardingChannelId = '1401851981668155462';

const attendancePath = path.join(__dirname, 'attendance.json');
const vcDataPath = path.join(__dirname, 'vc_data.json');
const pointPath = path.join(__dirname, 'points.json');
const onboardingMessagePath = path.join(__dirname, 'onboarding_message_id.txt');
const gameLogPath = './data/games.json';
const 승격채널ID = '123456789012345678';

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.trim() ? JSON.parse(raw) : {};
}
function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}
function formatVCMinutes(seconds) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return `${hours}시간 ${remain}분`;
}

// ✅ 메세지 명령어 처리
client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(';')) return;

  const [cmd, ...args] = message.content.slice(1).trim().split(/\s+/);
  const command = cmd.toLowerCase();
  const userId = message.author.id;
  const displayName = message.member?.nickname || message.author.username;
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const attendance = loadJSON(attendancePath);
  const vcData = loadJSON(vcDataPath);
  const points = loadJSON(pointPath);
  if (!points[userId]) points[userId] = { total: 0, 홍보: {}, 출석: [] };

  // ✅ 출석
  if (command === '출석') {
    if (points[userId].출석.includes(today)) {
      return message.reply(`✨${displayName}님은 오늘 이미 출석과 포인트를 적립했어요. 내일 또 오세요!✨`);
    }
    if (!attendance[userId]) attendance[userId] = { username: displayName, totalAttendance: 0, dates: [] };

    attendance[userId].totalAttendance++;
    attendance[userId].dates.push(today);
    saveJSON(attendancePath, attendance);

    points[userId].출석.push(today);
    points[userId].total += 5;
    saveJSON(pointPath, points);

    await message.reply(`✨ 출석 완료! 5점 포인트 적립✨`);
  }

  // ✅ 포인트확인
  if (command === '포인트확인') {
    const target = message.mentions.users.first() || message.author;
    const targetId = target.id;
    const data = points[targetId];
    if (!data) return message.reply('해당 유저의 포인트 정보가 없습니다.');
    await message.reply(`💰 ${target.username}님의 총 포인트: ${data.total}점`);
  }

  // ✅ 포인트랭킹
  if (command === '포인트랭킹') {
    const sorted = Object.entries(points)
      .map(([id, data]) => ({ id, total: data.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const lines = await Promise.all(sorted.map(async (entry, i) => {
      const member = await message.guild.members.fetch(entry.id).catch(() => null);
      return member ? `#${i + 1} ${member.displayName} - ${entry.total}점` : null;
    }));

    await message.reply(`🏆 포인트 상위 랭킹:\n${lines.filter(Boolean).join('\n')}`);
  }

  // ✅ 전체포인트랭킹
  if (command === '전체포인트랭킹') {
    const sorted = Object.entries(points)
      .map(([id, data]) => ({ id, total: data.total }))
      .sort((a, b) => b.total - a.total);

    const lines = await Promise.all(sorted.map(async (entry, i) => {
      const member = await message.guild.members.fetch(entry.id).catch(() => null);
      return member ? `#${i + 1} ${member.displayName} - ${entry.total}점` : null;
    }));

    await message.reply(`📊 전체 포인트 랭킹:\n${lines.filter(Boolean).join('\n')}`);
  }

  // ✅ 출석랭킹
  if (command === '출석랭킹') {
    const attendance = loadJSON(attendancePath);
    let month = args[0];

    if (month && /^\d{1,2}월$/.test(month)) {
      const monthNum = month.replace('월', '').padStart(2, '0');
      const year = new Date().getFullYear();
      month = `${year}-${monthNum}`;
    }

    const filtered = Object.entries(attendance).map(([id, data]) => ({
      id,
      count: month
        ? data.dates.filter(date => date.startsWith(month)).length
        : data.dates.length,
    }));

    const sorted = filtered.sort((a, b) => b.count - a.count).slice(0, 10);

    const lines = await Promise.all(
      sorted.map(async (entry, i) => {
        const member = await message.guild.members.fetch(entry.id).catch(() => null);
        return member ? `#${i + 1} ${member.displayName} - ${entry.count}회` : null;
      })
    );

    const title = month ? `📅 ${month} 출석 랭킹` : '📅 전체 누적 출석 랭킹';
    await message.reply(`${title}\n${lines.filter(Boolean).join('\n')}`);
  }

  // ✅ 출석현황
  if (command === '출석현황') {
    const target = message.mentions.users.first() || message.author;
    const targetId = target.id;
    const record = attendance[targetId];

    if (!record) return message.reply(`📅 ${target.username}님의 출석 기록이 없습니다.`);

    const total = record.totalAttendance || record.dates.length;
    await message.reply(`📅 ${target.username}님의 누적 출석 일수는 총 ${total}일입니다!`);
  }

  // ✅ 포인트 +지급/-차감 (최종 버전)
  if (command === '포인트' && (args[0] === '+지급' || args[0] === '-차감')) {
    const mention = message.mentions.users.first();
    const amount = parseInt(args[2]) || 3;
    const reason = args.slice(3).join(' ') || '사유 없음';

    if (!mention) return message.reply('❌ 포인트를 줄 대상을 멘션해주세요!');

    const targetId = mention.id;
    if (!points[targetId]) points[targetId] = { total: 0, 홍보: {}, 출석: [] };

    if (args[0] === '+지급') {
      points[targetId].total += amount;
      await message.channel.send(`✅ ${mention} 님에게 ${amount}점 포인트 지급 완료! (${reason})`);
    } else {
      points[targetId].total = Math.max(0, points[targetId].total - amount);
      await message.channel.send(`⚠️ ${mention} 님의 포인트 ${amount}점 차감 완료! (${reason})`);
    }

    saveJSON(pointPath, points);
  }

  // ✅ 출석미달목록 (최종 하나만)
  if (command === '출석미달목록') {
    const daysArg = parseInt(args[0]);
    const 기준일수 = daysArg === 60 ? 15 : 10;
    const 기준기간 = daysArg === 60 ? 60 : 30;

    const attendance = loadJSON(attendancePath);
    const members = await message.guild.members.fetch();
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 기준기간);

    const result = [];
    for (const [id, record] of Object.entries(attendance)) {
      const member = members.get(id);
      if (!member) continue;

      const recentDates = (record.dates || []).filter(d => new Date(d) >= cutoff);
      if (recentDates.length < 기준일수) {
        result.push(`- ${member.displayName} (${recentDates.length}일 출석)`);
      }
    }

    if (result.length === 0) {
      return message.reply(`✅ 최근 ${기준기간}일 기준 출석 미달자는 없습니다!`);
    }

    await message.reply(`🚨 출석 미달자 목록 (최근 ${기준기간}일 기준 / 기준: ${기준일수}일 이상)\n${result.join('\n')}`);
  }

  // ✅ 승격대상 (최종 하나만)
  if (command === '승격대상') {
    const guild = message.guild;
    const members = await guild.members.fetch();
    const attendance = loadJSON(attendancePath);
    const games = loadJSON(gameLogPath);

    const 도순역할 = guild.roles.cache.find(r => r.name === '도순');
    if (!도순역할) return message.reply('❌ "도순" 역할을 찾을 수 없습니다.');

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);

    let count = 0;
    for (const [id, member] of members) {
      if (!member.roles.cache.has(도순역할.id)) continue;

      const record = attendance[id];
      const attendanceDays = record?.dates?.filter(d => new Date(d) >= startDate).length || 0;
      const gameCount = games[id]?.totalGames || 0;

      if (attendanceDays >= 25 && gameCount >= 20) {
        count++;
        await sendPromotionCandidate(member, attendanceDays, gameCount);
      }
    }

    if (count === 0) {
      await message.reply('📋 현재 승격 조건을 충족한 도순 유저가 없습니다.');
    } else {
      await message.reply(`🎖️ 승격 대상자 ${count}명 자동 알림 전송 완료!`);
    }
  }
}); // 🔹 messageCreate 블록 끝

// ====== DISBOARD /bump 성공 감지 → 포인트 지급
client.on('messageCreate', async (msg) => { ... });

// (이하 VC 참여, 온보딩, interactionCreate, Webhook, 서버 실행 부분은 네 코드 그대로 유지)

// ✅ 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook 서버 & 온보딩 수신 서버 실행 중! http://localhost:${PORT}`);
});

client.login(token);
