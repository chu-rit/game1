const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// 정적 파일 제공
app.use(express.static(__dirname));

// 대기 중인 플레이어 저장
let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('사용자 연결됨:', socket.id);

    // 매칭 요청
    socket.on('requestMatch', () => {
        if (waitingPlayer === null) {
            // 첫 번째 플레이어가 대기
            waitingPlayer = socket;
            socket.emit('waiting');
        } else {
            // 두 번째 플레이어가 들어와서 매칭 성공
            const player1 = waitingPlayer;
            const player2 = socket;
            
            // 각 플레이어에게 게임 시작을 알림
            player1.emit('gameStart', { playerNumber: 1 });
            player2.emit('gameStart', { playerNumber: 2 });
            
            // 매칭된 상대방 소켓 ID 저장
            player1.opponent = player2;
            player2.opponent = player1;
            
            // 대기자 초기화
            waitingPlayer = null;
        }
    });

    // 게임 진행 중 상대방의 턴이 끝났을 때
    socket.on('turnEnd', (data) => {
        if (socket.opponent) {
            socket.opponent.emit('opponentTurnEnd', data);
        }
    });

    // 연결 해제 처리
    socket.on('disconnect', () => {
        console.log('사용자 연결 해제:', socket.id);
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        if (socket.opponent) {
            socket.opponent.emit('opponentDisconnected');
            socket.opponent.opponent = null;
        }
    });
});

// 서버 시작
const PORT = 3000;
http.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
