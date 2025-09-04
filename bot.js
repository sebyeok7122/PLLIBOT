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
const DISBOARD_BOT_ID = '302050872383242240'; // DISBOARD 공식 봇 ID
const PROMO_LIMIT_PER_DAY = 10;                // 하루 최대 지급 횟수
const BUMP_COOLDOWN_MS = 2 * 60 * 60 * 1000;   // 2시간 쿨다운 (원하면 0)

const promoPath = path.join(__dirname, 'promo.json');
function loadPromo() {
  if (fs.existsSync(promoPath)) return JSON.parse(fs.readFileSync(promoPath, 'utf8'));
  return { daily: {}, lastBumpAt: {} };
}
function savePromo(data) {
  fs.writeFileSync(promoPath, JSON.stringify(data, null, 2));
}

// (중복 집계 방지)
const processedPath = path.join(__dirname, 'promo_processed.json');
function loadProcessed() {
  return fs.existsSync(processedPath) ? JSON.parse(fs.readFileSync(processedPath, 'utf8')) : {};
}
function saveProcessed(d) {
  fs.writeFileSync(processedPath, JSON.stringify(d, null, 2));
}

// DISBOARD 보상 포인트 (원하면 숫자만 바꿔)
const PROMO_POINTS = 1;

// points.json 구조에 맞춘 지급 함수 (네 파일에 있는 loadJSON/saveJSON/pointPath를 그대로 씀)
async function awardPromoPoints(guild, userId, amount, reason = 'DISBOARD bump') {
  const points = loadJSON(pointPath);
  if (!points[userId]) points[userId] = { total: 0, 홍보: {}, 출석: [] };
  points[userId].total += amount;
  saveJSON(pointPath, points);

  // 로그 채널 공지 (있으면)
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

// 🔸 온보딩 상태 저장 유틸
const onboardingPath = path.join(__dirname, 'onboarding.json');

function loadOnboarding() {
  if (fs.existsSync(onboardingPath)) {
    return JSON.parse(fs.readFileSync(onboardingPath, 'utf8'));
  } else {
    return {};
  }
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

  if (command === '출석') {
    if (points[userId].출석.includes(today)) {
      return message.reply(`✨${displayName}님은 오늘 이미 출석과 포인트를 적립했어요. 내일 또 오세요!✨`);
    }
    if (!attendance[userId]) {
      attendance[userId] = { username: displayName, totalAttendance: 0, dates: [] };
    }
    attendance[userId].totalAttendance++;
    attendance[userId].dates.push(today);
    saveJSON(attendancePath, attendance);

    points[userId].출석.push(today);
    points[userId].total += 5;
    saveJSON(pointPath, points);

    await message.reply(`✨ 출석 완료! 5점 포인트 적립✨`);
  }

  if (command === '포인트확인') {
    const target = message.mentions.users.first() || message.author;
    const targetId = target.id;
    const data = points[targetId];
    if (!data) return message.reply('해당 유저의 포인트 정보가 없습니다.');
    await message.reply(`💰 ${target.username}님의 총 포인트: ${data.total}점`);
  }

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

  // ✅ 출석랭킹 명령어 (8월, 07월, 2025-08 모두 인식)
  if (command === '출석랭킹') {
    const attendance = loadJSON(attendancePath);
    let month = args[0];

    // "8월" 형식이면 2025-08로 변환
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

// ✅ 특정 유저의 누적 출석 일수 확인
  if (command === '출석현황') {
    const target = message.mentions.users.first() || message.author;
    const targetId = target.id;
    const attendance = loadJSON(attendancePath);
    const record = attendance[targetId];

    if (!record) {
      return message.reply(`📅 ${target.username}님의 출석 기록이 없습니다.`);
    }

    const total = record.totalAttendance || record.dates.length;
    await message.reply(`📅 ${target.username}님의 누적 출석 일수는 총 ${total}일입니다!`);
  }

// ✅ 포인트 지급 및 차감 명령어
if (message.content.startsWith(';포인트')) {
  const args = message.content.split(' ');
  const subcommand = args[1];
  const mention = message.mentions.users.first();

  if (!mention) {
    return message.reply('❌ 포인트를 줄 대상을 멘션해주세요!');
  }

  // JSON 불러오기
  let points = {};
  if (fs.existsSync(pointPath)) {
    points = JSON.parse(fs.readFileSync(pointPath, 'utf8'));
  }

  const userId = mention.id;
  const username = mention.tag;

  if (!points[userId]) {
    points[userId] = { total: 0, today: 0 };
  }

  if (subcommand === '+지급') {
    points[userId].total += 3;
    fs.writeFileSync(pointPath, JSON.stringify(points, null, 2));
    return message.reply(`✅ ${username} 님에게 포인트 **3점 지급** 완료!`);
  }

  if (subcommand === '-차감') {
    points[userId].total = Math.max(0, points[userId].total - 3);
    fs.writeFileSync(pointPath, JSON.stringify(points, null, 2));
    return message.reply(`⚠️ ${username} 님의 포인트 **3점 차감** 완료!`);
  }

  return message.reply('❌ 명령어 형식이 잘못되었습니다. `;포인트 +지급 @유저` 또는 `;포인트 -차감 @유저` 형식으로 입력해주세요.');
}

// ✅ 강퇴 대상 명령어 (출석 미달자 목록 확인)
if (command === '강퇴대상') {
  const attendance = loadJSON(attendancePath);
  const now = new Date();
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

  const defaulters = Object.entries(attendance).filter(([id, data]) => {
    const recentAttendance = data.dates.filter(dateStr => {
      const date = new Date(dateStr);
      return date >= twoMonthsAgo;
    });
    return recentAttendance.length < 15;
  });

  if (defaulters.length === 0) {
    return message.reply('✅ 최근 2개월간 출석 15일 미만인 유저는 없습니다.');
  }

  const lines = await Promise.all(
    defaulters.map(async ([id, data], i) => {
      const member = await message.guild.members.fetch(id).catch(() => null);
      return member ? `⚠️ ${member.displayName} - 최근 2개월 출석 ${data.dates.filter(d => new Date(d) >= twoMonthsAgo).length}일` : null;
    })
  );

  await message.reply(`📋 **출석 미달자 목록 (최근 2개월 기준)**\n${lines.filter(Boolean).join('\n')}`);
}

// ✅ 출석 미달 유저 강퇴 명령어
if (command === '출석검사') {
  const attendance = loadJSON(attendancePath);
  const today = new Date();
  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setMonth(today.getMonth() - 2);

  const targets = [];

  for (const [id, record] of Object.entries(attendance)) {
    const userDates = (record.dates || []).filter(dateStr => {
      const date = new Date(dateStr);
      return date >= twoMonthsAgo;
    });

    if (userDates.length < 15) {
      targets.push({ id, count: userDates.length });
    }
  }

  for (const { id, count } of targets) {
    const member = await message.guild.members.fetch(id).catch(() => null);
    if (!member) continue;

    const is오순 = member.roles.cache.some(r => r.name === '오순');
    if (!is오순) continue;

    try {
      await member.send(`🚨 [자동 알림]
최근 2개월 간 출석 ${count}일로 기준 미달되어 롤블리 서버에서 자동 강퇴 처리되었습니다.
재참여를 원하시면 운영진에게 문의해주세요.`);
    } catch (e) {
      console.log(`❌ ${member.user.tag}에게 DM 전송 실패`);
    }

    await member.kick(`최근 2개월 출석 ${count}일`);
    await message.channel.send(`👢 ${member.displayName}님을 출석 미달로 강퇴했습니다. (${count}일)`);
  }

  await message.channel.send(`✅ 출석 검사 완료! 총 ${targets.length}명 검토되었습니다.`);
}

  // ✅ 출석 조건 미달자 리스트 확인 명령어
  if (command === '출석미달목록') {
    const guild = message.guild;
    const attendance = loadJSON(attendancePath);
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - 2); // 2개월 전

    const 오순역할 = guild.roles.cache.find(r => r.name === '오순');
    if (!오순역할) return message.reply('❌ "오순" 역할을 찾을 수 없습니다.');

    const members = await guild.members.fetch();
    const targetMembers = members.filter(m => m.roles.cache.has(오순역할.id));

    const result = [];

    for (const [id, member] of targetMembers) {
      const data = attendance[id];
      if (!data) continue;

      const count = data.dates.filter(date => new Date(date) >= cutoff).length;
      if (count < 15) {
        result.push(`- ${member.displayName} (${count}일 출석)`);
      }
    }

    if (result.length === 0) {
      await message.reply('✅ 출석 조건 미달자는 현재 없습니다!');
    } else {
      await message.reply(`🚨 출석 조건 미달자 목록 (최근 2개월 출석 15일 미만):\n${result.join('\n')}`);
    }
  }
 
// ✅ VC 랭킹 명령어 (7일 or 30일 기준)
if (command === 'VC랭킹') {
  const vcLog = loadJSON(vcLogPath); // 예: ./data/vcLog.json
  const days = parseInt(args[0]) || 7;
  const now = new Date();

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days + 1); // 오늘 포함

  const userTime = {};

  for (const [userId, logs] of Object.entries(vcLog)) {
    for (const [dateStr, seconds] of Object.entries(logs)) {
      const logDate = new Date(dateStr);
      if (logDate >= startDate && logDate <= now) {
        if (!userTime[userId]) userTime[userId] = 0;
        userTime[userId] += seconds;
      }
    }
  }

  const sorted = Object.entries(userTime)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // 상위 10명

  if (sorted.length === 0) {
    return message.reply(`📊 최근 ${days}일간 VC 랭킹 기록이 없습니다!`);
  }

  const lines = await Promise.all(
    sorted.map(async ([userId, totalSec], idx) => {
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) return null;

      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      return `${idx + 1}위. ${member.displayName} - ${hours}시간 ${minutes}분`;
    })
  );

  await message.reply(`🎧 최근 ${days}일간 VC 랭킹:\n${lines.filter(Boolean).join('\n')}`);
}
 // ✅ VC 기록 초기화 명령어
if (command === 'VC리셋') {
  const option = args[0];
  const vcLog = loadJSON(vcLogPath);
  const guild = message.guild;

  if (!option) {
    return message.reply('형식: `;VC리셋 전체` / `;VC리셋 오순` / `;VC리셋 도순`');
  }

  if (option === '전체') {
    saveJSON(vcLogPath, {}); // 전체 초기화
    return message.reply('🧹 VC 기록이 전체 초기화되었습니다!');
  }

  // 역할별 리셋
  if (option === '오순' || option === '도순') {
    const role = guild.roles.cache.find(r => r.name === option);
    if (!role) return message.reply(`❌ "${option}" 역할을 찾을 수 없습니다.`);

    const members = await guild.members.fetch();
    const targetMembers = members.filter(m => m.roles.cache.has(role.id));

    for (const member of targetMembers.values()) {
      delete vcLog[member.id];
    }

    saveJSON(vcLogPath, vcLog);
    return message.reply(`🧹 VC 기록이 "${option}" 역할 대상만 초기화되었습니다!`);
  }

  return message.reply('❗ 올바른 옵션이 아닙니다. `전체`, `오순`, `도순` 중 하나를 입력해주세요.');
}

// ✅ 승격대상 명령어: 도순 → 오순 승격 후보자 확인
if (command === '승격대상') {
  const guild = message.guild;
  const members = await guild.members.fetch();
  const attendance = loadJSON(attendancePath);
  const games = loadJSON(gameLogPath); // 게임 기록 저장 파일 예시: { userId: { totalGames: 22 } }

  const 도순역할 = guild.roles.cache.find(r => r.name === '도순');
  if (!도순역할) return message.reply('❌ "도순" 역할을 찾을 수 없습니다.');

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 30); // 최근 30일 기준

  const result = [];

  for (const [id, member] of members) {
    if (!member.roles.cache.has(도순역할.id)) continue;

    // 출석일 계산
    const record = attendance[id];
    const attendanceDays = record?.dates?.filter(d => new Date(d) >= startDate).length || 0;

    // 게임 기록 계산
    const gameCount = games[id]?.totalGames || 0;

    if (attendanceDays >= 25 && gameCount >= 20) {
      result.push(`✅ ${member.displayName} - 출석 ${attendanceDays}일 / 내전 ${gameCount}판`);
    }
  }

  if (result.length === 0) {
    return message.reply('📋 승격 대상자는 현재 없습니다!');
  }

  await message.reply(`🎖️ **승격 대상자 목록** (출석 25일+ / 내전 20판+):\n${result.join('\n')}`);
}
// 상단 변수 선언
const 승격채널ID = '123456789012345678'; // 실제 승격 알림 채널 ID
const gameLogPath = './data/games.json'; // 내전 기록 저장 경로

// ✅ 승격 대상자 전송 함수 (이거 위에 있어야 함)
async function sendPromotionCandidate(member, attendanceDays, gameCount) {
  const channel = await client.channels.fetch(승격채널ID);
  if (!channel) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`승격:${member.id}`)
      .setLabel('승격 승인')
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({
    content: `🎖️ **승격 대상자 발견!**\n${member.displayName} 님 (출석 ${attendanceDays}일 / 내전 ${gameCount}판)`,
    components: [row],
  });
}

// ✅ 명령어 블록 내부에 아래 코드
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

if (command === '출석미달목록') {
  const daysArg = parseInt(args[0]);
  const 기준일수 = daysArg === 60 ? 15 : 10; // 60일 기준 15일, 30일 기준 10일
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

if (command === '출석현황전체') {
  const attendance = loadJSON(attendancePath);
  const members = await message.guild.members.fetch();

  const result = [];

  for (const [id, record] of Object.entries(attendance)) {
    const member = members.get(id);
    if (!member) continue;

    const total = record.totalAttendance || (record.dates?.length || 0);
    result.push({ name: member.displayName, total });
  }

  if (result.length === 0) {
    return message.reply('📋 출석 기록이 있는 유저가 없습니다.');
  }

  // 출석 일수 내림차순 정렬
  result.sort((a, b) => b.total - a.total);

  const lines = result.map((r, i) => `${i + 1}위. ${r.name} - ${r.total}일`);

  await message.reply(`📅 전체 출석 현황:\n${lines.join('\n')}`);
}

if (command === '출석리셋') {
  // 관리자 전용: 관리 권한 체크 (선택사항)
  if (!message.member.permissions.has('Administrator')) {
    return message.reply('❌ 이 명령어는 관리자만 사용할 수 있어요!');
  }

  // 출석 초기화
  saveJSON(attendancePath, {}); // 출석 기록 전체 삭제

  await message.reply('🧹 출석 기록이 전체 초기화되었습니다!');
}

if (command === '포인트리셋') {
  // 관리자 권한 확인 (선택사항)
  if (!message.member.permissions.has('Administrator')) {
    return message.reply('❌ 이 명령어는 관리자만 사용할 수 있어요!');
  }

  // 포인트 데이터 초기화
  saveJSON(pointPath, {}); // 모든 포인트 삭제

  await message.reply('🧹 포인트 기록이 전체 초기화되었습니다!');
}


// ✅ 포인트 수동 지급 명령어
  if (command === '포인트' && (args[0] === '+지급' || args[0] === '-차감')) {
    const mention = message.mentions.users.first();
    const amount = parseInt(args[2]);
    const reason = args.slice(3).join(' ') || '사유 없음';

    if (!mention || isNaN(amount)) {
      return message.reply('형식: `;포인트 +지급 @유저 5 내전1등` 또는 `;포인트 -차감 @유저 3 경고1회`');
    }

    const targetId = mention.id;
    if (!points[targetId]) points[targetId] = { total: 0, 홍보: {}, 출석: [] };

    if (args[0] === '+지급') {
      points[targetId].total += amount;
      await message.channel.send(`✅ ${mention} 님에게 ${amount}점 포인트가 지급되었습니다! (${reason})`);
    } else {
      points[targetId].total = Math.max(0, points[targetId].total - amount);
      await message.channel.send(`❎ ${mention} 님의 포인트가 ${amount}점 차감되었습니다. (${reason})`);
    }

    saveJSON(pointPath, points);
  }

});

// ====== DISBOARD /bump 성공 감지 → 포인트 지급 ======
client.on('messageCreate', async (msg) => {
  try {
    // 1) DISBOARD 봇이 보낸 메시지인지 확인
    if (msg.author?.id !== DISBOARD_BOT_ID) return;

    // 2) bump 성공 메시지 판단 (본문 + 임베드도 확인)
    const text = `${msg.content || ''} ${msg.embeds?.map(e => `${e.title ?? ''} ${e.description ?? ''}`).join(' ') ?? ''}`.toLowerCase();
    const isBump =
      text.includes('bump') ||
      text.includes('서버 추천') ||
      text.includes('리스트 상단') ||
      text.includes('상단에 노출');
    if (!isBump) return;

    // (선택) 특정 채널만 허용하려면 아래 두 줄 사용
    // const ALLOWED_CHANNEL_IDS = ['1412258954087497798'];  // 홍보 채널 ID
    // if (!ALLOWED_CHANNEL_IDS.includes(msg.channel.id)) return;

    // 3) 같은 메시지 중복 처리 방지
    const processed = loadProcessed();
    if (processed[msg.id]) return;

    // 4) /bump 실행자 찾기(멘션된 유저)
    const bumper = [...msg.mentions.users.values()][0];
    if (!bumper) return;

    const guild = msg.guild;
    const userId = bumper.id;

    // 5) 일일 서버 제한 + 개인 쿨다운 체크
    const promo = loadPromo();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    promo.daily[today] = promo.daily[today] ?? 0;

    if (promo.daily[today] >= PROMO_LIMIT_PER_DAY) {
      await msg.channel.send(`📛 오늘 홍보 포인트 한도(${PROMO_LIMIT_PER_DAY}회)에 도달했어요. 내일 다시 시도해 주세요!`);
      return;
    }

    const now = Date.now();
    const lastAt = promo.lastBumpAt[userId] ?? 0;
    if (BUMP_COOLDOWN_MS > 0 && now - lastAt < BUMP_COOLDOWN_MS) {
      const remainMin = Math.ceil((BUMP_COOLDOWN_MS - (now - lastAt)) / (60 * 1000));
      await msg.channel.send(`⏳ <@${userId}> 님은 아직 쿨다운 중이에요. 약 **${remainMin}분** 후 다시 가능!`);
      return;
    }

    // 6) 지급 & 기록
    await awardPromoPoints(guild, userId, PROMO_POINTS, 'DISBOARD bump');
    promo.daily[today] += 1;
    promo.lastBumpAt[userId] = now;
    savePromo(promo);

    processed[msg.id] = true;
    saveProcessed(processed);

    // 7) 사용자 피드백
    await msg.channel.send(`🎉 <@${userId}> 님, 서버 홍보 고맙습니다 💌 **+${PROMO_POINTS}점** 지급 ❤ (오늘 ${promo.daily[today]}/${PROMO_LIMIT_PER_DAY})`);
  } catch (e) {
    console.error('DISBOARD bump 감지 처리 중 오류:', e);
  }
});

// ✅ VC 참여 감지로 출석 및 포인트 자동 적립
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  const points = loadJSON(pointPath);
  const today = new Date().toISOString().split('T')[0];

  if (!points[userId]) points[userId] = { total: 0, 홍보: {}, 출석: [] };

  if (!oldState.channelId && newState.channelId) {
    if (!points[userId].출석.includes(today)) {
      points[userId].출석.push(today);
      points[userId].total += 5;
      saveJSON(pointPath, points);

      const channel = newState.guild.systemChannel;
      if (channel) {
        channel.send(`🎤 ${newState.member.displayName}님이 VC 참여로 5점 포인트를 적립했어요!`);
      }
    }
  }
});

// ✅ 서버 입장 시 온보딩 메시지 전송 + DM 전송 (고정 메시지 중복 방지)
client.on('guildMemberAdd', async member => {
  const channel = await member.guild.channels.fetch(onboardingChannelId);
  if (!channel) return;

  // ✅ 고정 메시지 목록 가져오기
  const pinnedMessages = await channel.messages.fetchPinned();

  // ✅ 이미 봇이 보낸 고정 메시지가 있으면 새로 안 보냄
  const alreadyExists = pinnedMessages.some(msg => msg.author.id === client.user.id);
  if (!alreadyExists) {
    const msg = await channel.send(`🎀 **롤블리에 오신 걸 환영합니다!** 🎀
💡 ** 먼저 서버 닉네임을 변경해주세요!**
예시: 새 벽#7122
💌 아래 온보딩 폼을 작성 후 제출하면 역할이 등록됩니다 💗
👉 폼 작성하러 가기: [ https://docs.google.com/forms/d/e/1FAIpQLSf5f3nMXz7_PK_QPxVgF_KA9lNI1--KqoyJ1sF5HLcsk1VUXA/viewform ]
💌 설문 완료 후 역할이 부여되기까지 1~2분 정도 소요될 수 있습니다
문의가 있을 땐 운영진에게 DM 주세요`);
    await msg.pin();
  }

// ✅ 새 유저 입장 시 온보딩 DM 로직 (이미 작성자는 DM 스킵)
client.on('guildMemberAdd', async (member) => {
  const userId = member.id;

  // (재입장 대비) 입장 시점에 이미 온보딩 완료면 타이머 자체 스킵
  const onboardingNow = loadOnboarding();
  if (onboardingNow[userId]) {
    console.log(`🔁 재입장 but 온보딩 완료: ${member.user.tag} → DM 스킵`);
    return;
  }

  // ✅ 5분 후 DM 전송: 그 시점에 '역할'과 '제출 여부'를 다시 확인
  setTimeout(async () => {
    try {
      const onboarding = loadOnboarding(); // 5분 사이 제출 가능 → 최신 상태 재확인
      const hasRole = member.roles.cache.some(r => r.name === '오순' || r.name === '도순');

      if (hasRole || onboarding[userId]) {
        console.log(`⛳ DM 스킵: ${member.user.tag} (hasRole:${hasRole}, submitted:${!!onboarding[userId]})`);
        return;
      }

      await member.send(`💌 **[롤블리 온보딩 안내]**
아직 온보딩 폼을 작성하지 않으셨네요!
👇 아래 링크로 빠르게 작성 부탁드립니다 💗
https://docs.google.com/forms/d/e/1FAIpQLSf5f3nMXz7_PK_QPxVgF_KA9lNI1--KqoyJ1sF5HLcsk1VUXA/viewform

작성 후 자동으로 역할이 부여돼요!`);

      console.log(`📨 온보딩 DM 발송: ${member.user.tag}`);
    } catch (e) {
      console.log(`❌ ${member.user.tag}에게 DM 전송 실패`, e?.message);
    }
  }, 5 * 60 * 1000);
});


// ✅ 승격 승인 버튼 처리
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('promote_')) return;

  const userId = interaction.customId.split('_')[1];
  const guild = await client.guilds.fetch(guildId);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const 도순 = member.roles.cache.find(r => r.name === '도순');
  const 오순 = guild.roles.cache.find(r => r.name === '오순');

  if (도순 && 오순) {
    await member.roles.remove(도순);
    await member.roles.add(오순);

    await interaction.update({
      content: `🌟 ${member.displayName} 님이 오순으로 승격되었습니다!`,
      components: [],
    });

    const logChannel = await client.channels.fetch(logChannelId);
    await logChannel.send(`📈 [승격 완료] ${member.displayName} → 오순 역할 부여`);
  }
});

// ✅ Webhook (POST 요청)으로 폼 제출 시 역할 부여
app.post('/onboarding', async (req, res) => {
  const { discordTag, selectedRole } = req.body;
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = guild.members.cache.find(m => `${m.user.username}#${m.user.discriminator}` === discordTag);
    if (!member) return res.status(404).send("🌼 죄송합니다, 해당 아이디를 찾을 수 없습니다.");

    const alreadyHasRole = member.roles.cache.some(r => r.name === '오순' || r.name === '도순');
    if (alreadyHasRole) return res.status(200).send("🌼 이미 온보딩을 완료하셨네요!");

    const role = guild.roles.cache.find(r => r.name === selectedRole);
    if (!role) return res.status(400).send("역할을 찾을 수 없습니다.");

    await member.roles.add(role);
    const logChannel = await client.channels.fetch(logChannelId);
    await logChannel.send(`✨ [온보딩 완료] 새 유저 등록!
✨ 디스코드 닉네임: ${discordTag}
✨ 선택한 역할: ${selectedRole}
✅ 역할이 성공적으로 부여되었습니다!`);
    res.status(200).send("역할 부여 완료!");
  } catch (error) {
    console.error("온보딩 처리 중 오류:", error);
    res.status(500).send("서버 오류 발생");
  }
});

// ✅ Webhook 수신 엔드포인트 (/role)
app.post('/role', async (req, res) => {
  const { nickname, role } = req.body;

  if (!nickname || !role) {
    return res.status(400).send('nickname 또는 role 누락됨');
  }

  try {
    const guild = await client.guilds.fetch(guildId); 
    const members = await guild.members.fetch();

    // 닉네임 또는 태그로 유저 찾기 (대소문자 무시)
    const target = members.find(m => {
      const fullTag = `${m.user.username}#${m.user.discriminator}`.toLowerCase();
      return fullTag === nickname.toLowerCase() || m.displayName.toLowerCase() === nickname.toLowerCase();
    });

    if (!target) {
      console.log(`❌ 일치하는 유저를 찾을 수 없음: ${nickname}`);
      return res.status(404).send('유저를 찾을 수 없음');
    }

    // 역할 찾기
    const roleObj = guild.roles.cache.find(r => r.name === role);
    if (!roleObj) {
      console.log(`❌ 역할을 찾을 수 없음: ${role}`);
      return res.status(404).send('역할을 찾을 수 없음');
    }

    // 역할 부여
    await target.roles.add(roleObj);
    console.log(`✅ ${target.displayName} 님에게 역할 ${role} 부여 완료`);
    res.send('ok');

  } catch (err) {
    console.error('🔥 Webhook 처리 중 오류 발생:', err);
    res.status(500).send('서버 오류');
  }
});


// ✅ 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook 서버 & 온보딩 수신 서버 실행 중! http://localhost:${PORT}`);
});


client.login(token);

