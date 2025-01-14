// Firebase imports
import { getDatabase, ref, set, onValue, remove, get, update, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// UI 요소
const matchButton = document.getElementById('match-button');
const gameContainer = document.getElementById('game-container');
const matchStatus = document.getElementById('match-status');
const roundElement = document.getElementById('round');
const numberSelectDiv = document.getElementById('number-select');
const resultDiv = document.getElementById('result');
const playerScoreElement = document.getElementById('player-score');
const opponentScoreElement = document.getElementById('opponent-score');
const drawScoreElement = document.getElementById('draw-score');
const restartButton = document.getElementById('restart-button');

// 규칙 모달 관련 요소
const rulesButton = document.getElementById('rules-button');
const rulesModal = document.getElementById('rules-modal');
const closeButton = document.querySelector('.close-button');

// 전역 변수
let playerId = null;
let playerRole = null;
let gameId = null;
let shuffledTileOrder = null;

// 게임 상태
let playerNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8];
let selectedNumber = null;
let isMyTurn = false;
let playerTotalScore = 0;
let opponentTotalScore = 0;
let drawScore = 0;
let currentRound = 1;
const WIN_SCORE = 5;

// 고유 플레이어 ID 생성 또는 복구
playerId = localStorage.getItem('playerId') || 'player_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('playerId', playerId);

// 이전 게임 상태 확인
async function checkExistingGame() {
    try {
        const db = getDatabase();
        const gamesRef = ref(db, 'games');
        const snapshot = await get(gamesRef);
        const games = snapshot.val();
        
        if (!games) return false;
        
        // 모든 게임을 확인하여 현재 플레이어가 참여 중인 게임 찾기
        for (const [gameKey, game] of Object.entries(games)) {
            if (game.player1?.id === playerId || game.player2?.id === playerId) {
                // 게임 찾음
                gameId = gameKey;
                playerRole = game.player1?.id === playerId ? 'player1' : 'player2';
                
                console.log('기존 게임 찾음:', {
                    gameId,
                    playerRole,
                    game
                });
                
                // 게임 상태 복구
                if (resultDiv) resultDiv.textContent = '게임 상태를 복구하는 중...';
                if (matchButton) matchButton.disabled = true;
                
                // 게임 상태 감시 시작
                listenToGame(gameId);
                
                return true;
            }
        }
        
        return false;
        
    } catch (error) {
        console.error('Error in checkExistingGame:', error);
        return false;
    }
}

// Firebase 초기화 후 게임 시작
async function initGame() {
    displayWaitingScreen();
    initializeFirebase();
    findOrCreateGame();
}

// 게임 초기화
async function initializeGame(gameId, role) {
    const db = getDatabase();
    const gameRef = ref(db, `games/${gameId}`);
    
    // 플레이어 역할 설정
    playerRole = role;
    
    // 타일 순서 초기화
    shuffledTileOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = shuffledTileOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTileOrder[i], shuffledTileOrder[j]] = [shuffledTileOrder[j], shuffledTileOrder[i]];
    }

    // 게임 상태 초기화
    const initialGameState = {
        currentRound: 1,
        drawScore: 0,
        currentTurn: 'player1', // 첫 턴은 항상 player1
        player1: role === 'player1' ? {
            id: playerId,
            score: 0,
            usedNumbers: []
        } : null,
        player2: role === 'player2' ? {
            id: playerId,
            score: 0,
            usedNumbers: []
        } : null
    };
    
    // 기존 게임이 있는지 확인
    const snapshot = await get(gameRef);
    const existingGame = snapshot.val();
    
    if (existingGame) {
        // 기존 게임에 참가
        if (role === 'player2') {
            await update(gameRef, {
                player2: {
                    id: playerId,
                    score: 0,
                    usedNumbers: []
                }
            });
        }
    } else {
        // 새 게임 생성
        await set(gameRef, initialGameState);
    }
    
    // 게임 상태 초기화
    playerNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    selectedNumber = null;
    isMyTurn = role === 'player1'; // player1이 첫 턴
    playerTotalScore = 0;
    opponentTotalScore = 0;
    drawScore = 0;
    currentRound = 1;
    
    // 게임 상태 감시 시작
    listenToGame(gameId);
}

// 게임 상태 감시
function listenToGame(gameId) {
    const db = getDatabase();
    const gameRef = ref(db, `games/${gameId}`);
    
    // 게임 상태 변경 감시
    onValue(gameRef, (snapshot) => {
        const game = snapshot.val();
        if (!game) {
            // 게임이 없어진 경우 초기 상태로 돌아감
            gameContainer.classList.add('hidden');
            matchButton.classList.remove('hidden');
            matchButton.disabled = false;
            resultDiv.textContent = '게임을 시작하려면 매칭 버튼을 클릭하세요.';
            return;
        }
        
        // 게임 시작 조건 체크 (양쪽 플레이어 모두 참여)
        const bothPlayersJoined = game.player1?.id && game.player2?.id;
        
        if (bothPlayersJoined) {
            // 게임 화면 표시
            gameContainer.classList.remove('hidden');
            matchButton.classList.add('hidden');
            matchStatus.textContent = '게임이 시작되었습니다!';
            
            // 게임 상태 업데이트
            updateGameState(game);
        } else {
            // 상대방 대기 중
            gameContainer.classList.add('hidden');
            matchButton.classList.add('hidden');
            matchStatus.textContent = '상대방을 기다리는 중...';
        }
    });
}

// 상대방 남은 타일 업데이트
function updateOpponentTilesCount(game) {
    const tilesDisplay = document.getElementById('opponent-tiles-display');
    if (!tilesDisplay) return;

    // 타일 디스플레이 초기화
    tilesDisplay.innerHTML = '';

    // 상대방의 남은 숫자 배열 가져오기
    const opponent = playerRole === 'player1' ? game.player2 : game.player1;
    if (!opponent) return;

    const usedNumbers = opponent.usedNumbers || [];
    const allNumbers = shuffledTileOrder || [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const remainingNumbers = allNumbers.filter(num => !usedNumbers.includes(num));

    // 저장된 순서대로 타일 생성
    remainingNumbers.forEach(num => {
        const tile = document.createElement('div');
        tile.className = `opponent-tile ${num % 2 === 0 ? 'black' : 'white'}`;
        tilesDisplay.appendChild(tile);
    });
}

// 게임 상태 업데이트
function updateGameState(game) {
    if (!game) return;
    
    try {
        // 게임 상태 전체 로깅 강화
        console.log('게임 상태 상세 로그:', {
            game: JSON.parse(JSON.stringify(game)), // 깊은 복사로 전체 상태 로깅
            playerRole,
            playerId,
            selectedNumber,
            currentRound: game.currentRound,
            currentTurn: game.currentTurn
        });
        
        // 양쪽 플레이어가 모두 참여했는지 확인
        const bothPlayersJoined = game.player1?.id && game.player2?.id;
        
        if (!bothPlayersJoined) {
            console.log('양쪽 플레이어가 모두 참여하지 않음');
            return;
        }
        
        // 점수 업데이트
        if (playerRole === 'player1') {
            playerTotalScore = game.player1.score || 0;
            opponentTotalScore = game.player2.score || 0;
        } else {
            playerTotalScore = game.player2.score || 0;
            opponentTotalScore = game.player1.score || 0;
        }
        drawScore = game.drawScore || 0;
        
        // 라운드 업데이트
        if (game.currentRound) {
            currentRound = game.currentRound;
            console.log('라운드 업데이트:', {
                storedRound: game.currentRound,
                localRound: currentRound
            });
        } else {
            console.log('currentRound가 존재하지 않음');
        }
        
        // 라운드 표시 업데이트
        if (roundElement) {
            roundElement.textContent = `라운드 ${currentRound}`;
        }
        
        // 사용 가능한 숫자 업데이트 (로깅 강화)
        const myUsedNumbers = playerRole === 'player1' ? 
            (game.player1?.usedNumbers || []) : 
            (game.player2?.usedNumbers || []);
        
        console.log('사용된 숫자 디버그:', {
            playerRole,
            myUsedNumbers,
            game: {
                player1UsedNumbers: game.player1?.usedNumbers,
                player2UsedNumbers: game.player2?.usedNumbers
            }
        });
        
        // 모든 숫자에서 사용된 숫자 제외
        playerNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(n => !myUsedNumbers.includes(n));
        
        console.log('남은 숫자:', playerNumbers);
        
        // 턴 상태 업데이트
        const prevTurn = isMyTurn;
        isMyTurn = game.currentTurn === playerRole;
        
        // 라운드 종료 조건 확인
        const player1UsedNumbers = game.player1?.usedNumbers || [];
        const player2UsedNumbers = game.player2?.usedNumbers || [];
        
        console.log('라운드 종료 조건 상세 로그:', {
            player1UsedNumbers,
            player2UsedNumbers,
            currentRound: game.currentRound,
            lastMove: game.lastMove,
            lastMovePlayer: game.lastMove?.player,
            playerId: playerId
        });
        
        // 두 플레이어 모두 숫자를 선택했다면 라운드 종료
        if (player1UsedNumbers.length > 0 && 
            player2UsedNumbers.length > 0 && 
            player1UsedNumbers.length === player2UsedNumbers.length) {
            console.log('라운드 종료 트리거');
            handleRoundEnd(game);
        }
        
        // 상대방 남은 타일 업데이트
        updateOpponentTilesCount(game);
        
        // UI 업데이트
        updateScoreDisplay();
        updateTurnState(game);
        displayNumberButtons();
        
    } catch (error) {
        console.error('게임 상태 업데이트 중 오류:', error);
    }
}

// 상대방 선택 처리
async function handleOpponentMove(game) {
    if (!game || !game.lastMove) return;
    
    const opponentMove = game.lastMove;
    const myNumber = selectedNumber;
    
    if (!opponentMove || !myNumber) return;
    
    console.log('라운드 종료:', {
        myNumber,
        opponentNumber: opponentMove.number,
        currentRound,
        currentTurn: game.currentTurn
    });
    
    try {
        const db = getDatabase();
        const nextRound = (game.currentRound || 1) + 1;
        
        // 승자 판정 및 점수 업데이트
        const updates = {};
        
        if (myNumber > opponentMove.number) {
            // 내가 승리
            if (playerRole === 'player1') {
                updates['player1/score'] = (game.player1.score || 0) + 1;
            } else {
                updates['player2/score'] = (game.player2.score || 0) + 1;
            }
        } else if (myNumber < opponentMove.number) {
            // 상대가 승리
            if (playerRole === 'player1') {
                updates['player2/score'] = (game.player2.score || 0) + 1;
            } else {
                updates['player1/score'] = (game.player1.score || 0) + 1;
            }
        } else {
            // 무승부
            updates['drawScore'] = (game.drawScore || 0) + 1;
        }
        
        // 새 라운드 설정
        updates['currentRound'] = nextRound;
        updates['lastMove'] = null;
        updates['currentTurn'] = 'player1';  // 새 라운드는 항상 player1부터
        
        console.log('라운드 종료 업데이트:', updates);
        
        // Firebase 업데이트
        await update(ref(db, `games/${gameId}`), updates);
        
        // 로컬 상태 초기화
        selectedNumber = null;
        isMyTurn = playerRole === 'player1';  // player1이면 턴 시작
        
        console.log('새 라운드 시작:', {
            round: nextRound,
            isMyTurn,
            playerRole,
            selectedNumber
        });
        
        // UI 업데이트
        updateUI();
        
    } catch (error) {
        console.error('Error in handleOpponentMove:', error);
    }
}

// 턴 상태 업데이트
function updateTurnState(game) {
    if (!game) return;
    
    try {
        // 내가 이미 선택한 경우
        if (selectedNumber !== null) {
            isMyTurn = false;
            matchStatus.textContent = '상대방의 턴입니다.';
        }
        // 새 라운드 시작
        else if (!game.lastMove) {
            isMyTurn = game.currentTurn === playerRole;
            matchStatus.textContent = isMyTurn ? '당신의 턴입니다!' : '상대방의 턴입니다.';
        }
        
        displayNumberButtons();
    } catch (error) {
        console.error('Error in updateTurnState:', error);
    }
}

// 점수 업데이트
function updateScores(game) {
    if (!game || !game.player1 || !game.player2) return;
    
    try {
        if (playerRole === 'player1') {
            playerTotalScore = game.player1.score || 0;
            opponentTotalScore = game.player2.score || 0;
        } else {
            playerTotalScore = game.player2.score || 0;
            opponentTotalScore = game.player1.score || 0;
        }
        drawScore = game.drawScore || 0;
        
        updateScoreDisplay();
    } catch (error) {
        console.error('Error in updateScores:', error);
    }
}

function updateScoreDisplay() {
    if (playerScoreElement && opponentScoreElement && drawScoreElement) {
        playerScoreElement.textContent = playerTotalScore;
        opponentScoreElement.textContent = opponentTotalScore;
        drawScoreElement.textContent = drawScore;
    }
}

// 숫자 선택 처리
async function selectNumber(number) {
    if (!isMyTurn || selectedNumber !== null) {
        console.log('숫자 선택 불가:', { isMyTurn, selectedNumber });
        return;
    }
    
    try {
        const db = getDatabase();
        const gameRef = ref(db, `games/${gameId}`);
        
        // 현재 게임 상태 가져오기
        const snapshot = await get(gameRef);
        const game = snapshot.val();
        
        // 턴 확인
        if (game.currentTurn !== playerRole) {
            console.log('잘못된 턴:', { currentTurn: game.currentTurn, playerRole });
            return;
        }
        
        console.log('숫자 선택 시작:', {
            number,
            playerRole,
            currentTurn: game.currentTurn
        });
        
        // 선택한 숫자 저장
        selectedNumber = number;
        
        // 현재 사용된 숫자 배열 가져오기
        const currentPlayer = game[playerRole] || {};
        const usedNumbers = [...(currentPlayer.usedNumbers || []), number];
        
        // 게임 상태 업데이트를 위한 객체 생성
        const nextTurn = playerRole === 'player1' ? 'player2' : 'player1';
        const updateData = {
            currentTurn: nextTurn,
            lastMove: {
                player: playerId,
                number: number,
                timestamp: Date.now()
            }
        };
        
        // player1 또는 player2 객체 전체를 업데이트
        updateData[playerRole] = {
            ...(game[playerRole] || {}),
            id: playerId,
            usedNumbers: usedNumbers
        };
        
        console.log('Firebase 업데이트 데이터:', updateData);
        
        // Firebase 업데이트
        await update(gameRef, updateData);
        
        // UI 업데이트
        isMyTurn = false; // 턴 상태 명확히 설정
        displayNumberButtons();
        matchStatus.textContent = '상대방의 차례입니다.';
        
        console.log('숫자 선택 완료 및 턴 전환:', {
            number,
            playerRole,
            nextTurn,
            selectedNumber,
            isMyTurn
        });
        
        // game.lastMove 설정 명확히 함
        if (game.lastMove) {
            console.log('game.lastMove 설정:', game.lastMove);
        } else {
            console.log('game.lastMove 설정 안됨');
        }
        
    } catch (error) {
        console.error('Error in selectNumber:', error);
        selectedNumber = null;
        displayNumberButtons();
    }
}

// 라운드 종료 처리
async function handleRoundEnd(game) {
    console.log('handleRoundEnd 호출됨 - 상세 로그:', {
        game: JSON.parse(JSON.stringify(game)),
        currentRound: game.currentRound,
        lastMove: game.lastMove,
        playerRole: playerRole
    });

    // 마지막 이동 및 사용된 숫자 확인
    if (!game.lastMove) {
        console.log('라운드 종료 실패: lastMove 없음');
        return;
    }

    if (!game.player1?.usedNumbers || !game.player2?.usedNumbers) {
        console.log('라운드 종료 실패: 플레이어 사용된 숫자 없음');
        return;
    }

    if (game.player1.usedNumbers.length === 0 || game.player2.usedNumbers.length === 0) {
        console.log('라운드 종료 실패: 사용된 숫자 배열 비어있음');
        return;
    }

    try {
        const db = getDatabase();
        const gameRef = ref(db, `games/${gameId}`);

        // 각 플레이어의 마지막 선택 숫자 확인
        const player1LastNumber = game.player1.usedNumbers[game.player1.usedNumbers.length - 1];
        const player2LastNumber = game.player2.usedNumbers[game.player2.usedNumbers.length - 1];

        console.log('플레이어 선택 숫자:', {
            player1LastNumber,
            player2LastNumber
        });

        // 라운드 승패 판단 로직
        let winner = null;
        let drawScore = game.drawScore || 0;

        if (player1LastNumber > player2LastNumber) {
            winner = 'player1';
        } else if (player2LastNumber > player1LastNumber) {
            winner = 'player2';
        } else {
            // 무승부인 경우
            drawScore++;
            winner = null;
        }

        console.log('라운드 승자:', winner);

        // 업데이트할 데이터 준비
        const updateData = {
            // 명시적으로 currentRound 증가
            [`currentRound`]: (game.currentRound || 1) + 1,
            // 승자가 있으면 승자의 차례, 없으면 이전 턴의 반대 플레이어
            currentTurn: winner || (game.currentTurn === 'player1' ? 'player2' : 'player1'),
            drawScore: drawScore,
            lastMove: null
        };

        console.log('라운드 업데이트 데이터:', {
            oldRound: game.currentRound,
            newRound: updateData.currentRound,
            currentTurn: updateData.currentTurn
        });

        // 승자가 있는 경우 점수 증가
        if (winner) {
            updateData[winner] = {
                ...game[winner],
                score: (game[winner].score || 0) + 1
            };
        }

        // 게임 종료 조건 확인 (예: 5점 도달)
        const player1Score = updateData.player1?.score || game.player1.score || 0;
        const player2Score = updateData.player2?.score || game.player2.score || 0;

        if (player1Score >= WIN_SCORE || player2Score >= WIN_SCORE) {
            // 게임 종료 처리
            updateData.gameStatus = 'ended';
            handleGameEnd({
                player1: { score: player1Score },
                player2: { score: player2Score }
            });
        }

        console.log('Firebase 업데이트 데이터:', updateData);

        // Firebase 업데이트
        await update(gameRef, updateData);

        // 상태 초기화
        selectedNumber = null;
        isMyTurn = playerRole === updateData.currentTurn;

        // UI 업데이트
        displayNumberButtons();
        updateScoreDisplay();
        
        if (isMyTurn) {
            matchStatus.textContent = '당신의 차례입니다.';
        } else {
            matchStatus.textContent = '상대방의 차례입니다.';
        }

    } catch (error) {
        console.error('라운드 종료 중 오류:', error);
    }
}

// 게임 종료 처리 함수 추가
function handleGameEnd(game) {
    const player1Won = game.player1.score >= WIN_SCORE;
    const player2Won = game.player2.score >= WIN_SCORE;
    
    // 결과 메시지 표시
    if (player1Won) {
        resultDiv.textContent = playerRole === 'player1' ? '승리했습니다!' : '패배했습니다!';
    } else if (player2Won) {
        resultDiv.textContent = playerRole === 'player2' ? '승리했습니다!' : '패배했습니다!';
    }
    
    // 게임 컨트롤 비활성화
    isMyTurn = false;
    
    // 재시작 버튼 표시
    if (restartButton) {
        restartButton.classList.remove('hidden');
    }
    
    updateUI();
}

// 게임 재시작 함수 추가
async function restartGame() {
    try {
        const db = getDatabase();
        
        // 현재 게임 상태 가져오기
        const snapshot = await get(ref(db, `games/${gameId}`));
        const currentGame = snapshot.val();
        
        if (!currentGame) {
            console.error('게임 상태를 찾을 수 없습니다');
            return;
        }
        
        // 새 게임 상태로 초기화
        const gameData = {
            player1: { 
                id: currentGame.player1.id, 
                score: 0,
                usedNumbers: []  // player1의 사용한 숫자 초기화
            },
            player2: { 
                id: currentGame.player2.id, 
                score: 0,
                usedNumbers: []  // player2의 사용한 숫자 초기화
            },
            currentRound: 1,
            currentTurn: 'player1',
            drawScore: 0,
            lastMove: null
        };
        
        await set(ref(db, `games/${gameId}`), gameData);
        
        // 로컬 상태 초기화
        selectedNumber = null;
        isMyTurn = playerRole === 'player1';
        
        // 재시작 버튼 숨기기
        if (restartButton) {
            restartButton.classList.add('hidden');
        }
        
        resultDiv.textContent = '새 게임이 시작되었습니다!';
        
        // 상태가 Firebase에서 업데이트되면 updateGameState에서 playerNumbers가 업데이트됨
        
    } catch (error) {
        console.error('Error in restartGame:', error);
    }
    
    // 타일 순서 다시 섞기
    shuffledTileOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = shuffledTileOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTileOrder[i], shuffledTileOrder[j]] = [shuffledTileOrder[j], shuffledTileOrder[i]];
    }
}

// UI 요소 업데이트
function updateUI() {
    // 라운드 표시
    roundElement.textContent = `라운드 ${currentRound}`;
    
    // 점수 표시
    playerScoreElement.textContent = `플레이어: ${playerTotalScore}`;
    opponentScoreElement.textContent = `상대방: ${opponentTotalScore}`;
    drawScoreElement.textContent = `무승부: ${drawScore}`;
    
    // 현재 턴 표시
    if (isMyTurn) {
        matchStatus.textContent = '당신의 차례입니다.';
    } else {
        matchStatus.textContent = '상대방의 차례입니다.';
    }
    
    // 게임 컨테이너가 보이도록 설정
    gameContainer.classList.remove('hidden');
    matchButton.classList.add('hidden');
    
    // 숫자 버튼 업데이트
    displayNumberButtons();
}

// 대기 화면 표시
function showWaitingScreen() {
    try {
        if (matchStatus) {
            matchStatus.textContent = '상대방을 기다리는 중...';
        }
        if (gameContainer) {
            gameContainer.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error in showWaitingScreen:', error);
    }
}

// 게임 화면 표시
function showGameScreen() {
    try {
        if (gameContainer) {
            gameContainer.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error in showGameScreen:', error);
    }
}

// 게임 준비 상태 확인
function isGameReady() {
    return playerRole !== null && gameId !== null;
}

// 매칭 시스템
async function joinGame() {
    console.log('joinGame called');
    const db = getDatabase();
    
    // 기존 게임이 있다면 초기화
    if (gameId) {
        await remove(ref(db, `games/${gameId}`));
        await remove(ref(db, 'waiting_room'));
        resetGame();
    }
    
    matchButton.disabled = true;
    matchStatus.textContent = '상대방을 찾는 중...';

    try {
        // 대기 중인 게임이 있는지 확인
        const waitingRef = ref(db, 'waiting_room');
        const waitingSnapshot = await get(waitingRef);
        const waitingGame = waitingSnapshot.val();
        
        if (!waitingGame) {
            console.log('creating new game');
            // 대기 중인 게임이 없으면 새 게임 생성
            gameId = 'game_' + Math.random().toString(36).substr(2, 9);
            playerRole = 'player1';
            
            // 대기실에 게임 등록
            await set(waitingRef, {
                gameId: gameId,
                player1: playerId
            });

            // 게임 초기화
            await initializeGame(gameId, playerRole);
            matchStatus.textContent = '상대방을 기다리는 중...';
            
            // 대기실 감시
            onValue(waitingRef, (snapshot) => {
                if (!snapshot.exists()) {
                    // 대기실이 비워지면 게임 시작
                    matchStatus.textContent = '게임 시작!';
                    gameContainer.classList.remove('hidden');
                    isMyTurn = true;
                    updateGameState();
                }
            });
        } else {
            console.log('joining existing game');
            // 기존 게임에 참가
            gameId = waitingGame.gameId;
            playerRole = 'player2';
            
            // 게임에 참가
            await set(ref(db, `games/${gameId}/player2`), {
                id: playerId,
                score: 0
            });
            
            // 대기실에서 제거
            await remove(waitingRef);
            
            // 게임 시작
            await initializeGame(gameId, playerRole);
            matchStatus.textContent = '게임 시작!';
            gameContainer.classList.remove('hidden');
            isMyTurn = false;
            updateGameState();
        }
        
        // 게임 상태 감시
        listenToGame(gameId);
    } catch (error) {
        console.error('Error in joinGame:', error);
        matchButton.disabled = false;
        matchStatus.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
    }
}

// 규칙 모달 표시
rulesButton.addEventListener('click', () => {
    rulesModal.classList.remove('hidden');
});

// 규칙 모달 닫기
closeButton.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
});

// 모달 외부 클릭시 닫기
window.addEventListener('click', (event) => {
    if (event.target === rulesModal) {
        rulesModal.classList.add('hidden');
    }
});

// ESC 키로 모달 닫기
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !rulesModal.classList.contains('hidden')) {
        rulesModal.classList.add('hidden');
    }
});

// 페이지 로드 시 실행
window.onload = function() {
    // UI 요소 초기화
    if (!matchButton || !gameContainer || !matchStatus || !roundElement || 
        !numberSelectDiv || !resultDiv || !playerScoreElement || !opponentScoreElement || !drawScoreElement) {
        console.error('필요한 UI 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 플레이어 ID 생성
    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    
    // 이벤트 리스너 설정
    matchButton.addEventListener('click', joinGame);
    
    // 초기 UI 상태 설정
    gameContainer.classList.add('hidden');
    matchStatus.textContent = '게임 시작 대기중...';
}

// 게임 리셋
function resetGame() {
    playerNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    selectedNumber = null;
    displayNumberButtons();
}

// 숫자 버튼 표시
function displayNumberButtons() {
    const numberSelect = document.getElementById('number-select');
    if (!numberSelect) {
        console.error('number-select 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 기존 버튼 초기화
    numberSelect.innerHTML = '';
    
    // 사용 가능한 숫자 결정 로직
    const allNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    let availableNumbers = allNumbers;
    
    // 디버그: playerNumbers 상태 확인
    console.log('displayNumberButtons 호출:', {
        playerNumbers,
        selectedNumber,
        isMyTurn
    });
    
    // playerNumbers가 정의되어 있고 비어있지 않다면 필터링
    if (playerNumbers && playerNumbers.length > 0) {
        availableNumbers = allNumbers.filter(n => playerNumbers.includes(n));
    }
    
    console.log('사용 가능한 숫자:', availableNumbers);
    
    // 게임 규칙에 따른 숫자 타일 생성
    availableNumbers.forEach(number => {
        const button = document.createElement('button');
        button.textContent = number;
        button.classList.add('number-button');
        
        // 숫자에 따라 검은색/흰색 구분
        if (number % 2 === 0) {
            // 짝수: 검은색 타일
            button.classList.add('black-number');
        } else {
            // 홀수: 흰색 타일
            button.classList.add('white-number');
        }
        
        // 선택 불가능한 경우 비활성화
        if (!isMyTurn || selectedNumber !== null) {
            button.disabled = true;
        }
        
        // 숫자 선택 이벤트 리스너
        button.addEventListener('click', () => {
            selectNumber(number);
        });
        
        numberSelect.appendChild(button);
    });
    
    console.log('타일 생성 완료:', numberSelect.children.length + '개의 타일');
}
