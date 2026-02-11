(function() {
    'use strict';

    // ========== CSS 삽입 ==========
    var style = document.createElement('style');
    style.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* 떠다니는 챗봇 버튼 */
        #chatbot-toggle-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 50%;
            border: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            transition: transform 0.3s;
        }

        #chatbot-toggle-btn:hover {
            transform: scale(1.1);
        }

        #chatbot-toggle-btn svg {
            width: 30px;
            height: 30px;
            fill: white;
        }

        .chatbot-container {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            height: 600px;
            max-height: calc(100vh - 40px);
            background: #DCE2F0;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            border-radius: 16px;
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 99999;
        }

        .chatbot-container.open {
            display: flex;
            transition: all 0.3s ease;
        }

        /* 데스크탑: 우측 하단 초기 위치 */
        @media (min-width: 481px) {
            .chatbot-container.open {
                top: auto;
                left: auto;
                bottom: 90px;
                right: 20px;
                transform: none;
            }
        }

        /* 전체 화면 모드 */
        .chatbot-container.fullscreen {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            max-width: 100vw !important;
            border-radius: 0 !important;
            transform: none !important;
            z-index: 100000 !important;
        }

        /* 드래그 중 선택 방지 */
        .chatbot-header.dragging { cursor: grabbing !important; }
        .chatbot-container.dragging { transition: none !important; }

        @media (max-width: 480px) {
            .chatbot-container {
                width: calc(100vw - 40px);
                height: calc(100vh - 120px);
                right: 20px;
                bottom: 90px;
            }
        }

        /* ===== 로그인/회원가입 ===== */
        .auth-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            text-align: center;
        }
        .auth-area h2 { margin-bottom: 8px; color: #333; }
        .auth-area p { color: #666; margin-bottom: 24px; font-size: 14px; }
        .auth-area input {
            width: 100%; max-width: 360px;
            padding: 12px 16px; margin: 6px 0;
            border: 2px solid #e0e0e0; border-radius: 8px; font-size: 15px;
        }
        .auth-area input:focus {
            border-color: #667eea;
            outline: none;
        }
        .auth-area button {
            width: 100%; max-width: 360px;
            padding: 12px; margin-top: 16px;
            background: #667eea; color: white; border: none;
            border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;
        }
        .auth-area button:hover { background: #5568d3; }
        .auth-toggle {
            margin-top: 16px;
            font-size: 14px;
            color: #666;
        }
        .auth-toggle a {
            color: #667eea;
            cursor: pointer;
            text-decoration: none;
        }
        .auth-toggle a:hover {
            text-decoration: underline;
        }

        /* ===== 채팅 영역 ===== */
        #chatArea { display: none; flex-direction: column; flex: 1; min-height: 0; }
        #chatArea.visible { display: flex; }
        #loginArea.hidden { display: none; }
        #signupArea { display: none; }
        #signupArea.visible { display: flex; }

        /* ===== 헤더 (고정) ===== */
        .chatbot-header {
            background: #50586C;
            color: white; padding: 16px 20px; text-align: center;
            flex-shrink: 0; position: relative;
            cursor: move;
        }
        .chatbot-header h1 { font-size: 22px; margin-bottom: 4px; }
        .usage-info { font-size: 13px; opacity: 0.9; }

        /* 로그아웃 버튼 */
        .logout-btn {
            position: absolute; top: 14px; right: 16px;
            background: rgba(255,255,255,0.2); color: white;
            border: 1px solid rgba(255,255,255,0.4);
            padding: 4px 10px; border-radius: 12px;
            font-size: 12px; cursor: pointer;
        }
        .logout-btn:hover { background: rgba(255,255,255,0.35); }

        /* ===== 메시지 스크롤 영역 ===== */
        .chat-messages {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            padding: 16px 20px;
            background: #fafafa;
        }

        /* ===== 메시지 ===== */
        .message { margin-bottom: 12px; }
        .message.user { text-align: right; }
        .message.bot  { text-align: left; }

        .bubble {
            display: inline-block;
            max-width: 88%;
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 15px;
            word-break: break-word;
            text-align: left;
        }
        .message.user .bubble { background: #667eea; color: white; }
        .message.bot  .bubble { background: white; border: 1px solid #e0e0e0; color: #333; }

        /* 봇 답변 내부 스타일 */
        .message.bot .bubble strong { color: #667eea; font-weight: 700; }
        .message.bot .bubble em { color: #555; font-style: italic; }
        .message.bot .bubble code {
            background: #f0f3ff; color: #667eea;
            padding: 1px 6px; border-radius: 3px; font-size: 14px;
            font-family: 'Consolas', monospace;
        }

        .message.bot .bubble .line {
            display: block;
            text-align: left;
            padding-left: 0;
            margin-left: 0;
            line-height: 1.7;
            margin-bottom: 1px;
        }
        .message.bot .bubble .gap { height: 8px; }
        .message.bot .bubble .divider { height: 1px; background: #eee; margin: 4px 0; }

        .msg-time { font-size: 11px; color: #999; margin-top: 3px; }
        .message.user .msg-time { text-align: right; }

        /* ===== 로딩 / 에러 ===== */
        .loading { display: none; padding: 8px; text-align: center; color: #667eea; flex-shrink: 0; }
        .loading.active { display: block; }
        .error-message { background: #fee; color: #c33; padding: 10px 16px; border-radius: 6px; margin: 6px 16px; display: none; flex-shrink: 0; }
        .error-message.active { display: block; }

        /* ===== 입력 영역 (고정) ===== */
        .chat-input-area { padding: 12px 16px; background: white; border-top: 1px solid #e0e0e0; flex-shrink: 0; }
        .input-wrapper { display: flex; gap: 8px; }
        #questionInput {
            flex: 1; padding: 10px 14px;
            border: 2px solid #e0e0e0; border-radius: 20px;
            font-size: 15px; outline: none;
        }
        #questionInput:focus { border-color: #667eea; }
        #sendButton {
            padding: 10px 22px; background: #667eea; color: white;
            border: none; border-radius: 20px; font-size: 15px;
            font-weight: 600; cursor: pointer;
        }
        #sendButton:hover { background: #5568d3; }
        #sendButton:disabled { background: #ccc; cursor: not-allowed; }

        /* ===== 퀴즈 버튼 ===== */
        .quiz-toggle-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #f093fb, #f5576c);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 10px;
        }
        .quiz-toggle-btn:hover {
            opacity: 0.9;
        }
        
        /* ===== 퀴즈 영역 ===== */
        .quiz-area {
            display: none;
            padding: 20px;
            background: white;
            border-radius: 12px;
            margin: 0 20px 16px 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .quiz-area.active {
            display: block;
        }
        .quiz-word {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            text-align: center;
            margin-bottom: 8px;
        }
        .quiz-pos {
            text-align: center;
            color: #999;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .quiz-choice {
            padding: 14px;
            margin: 8px 0;
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            cursor: pointer;
            font-size: 15px;
            transition: all 0.2s;
        }
        .quiz-choice:hover {
            background: #e9ecef;
            border-color: #667eea;
        }
        .quiz-choice.correct {
            background: #d4edda;
            border-color: #28a745;
            color: #155724;
        }
        .quiz-choice.wrong {
            background: #f8d7da;
            border-color: #dc3545;
            color: #721c24;
        }
        .quiz-choice.disabled {
            cursor: not-allowed;
        }
        .quiz-result {
            text-align: center;
            margin-top: 16px;
            padding: 12px;
            border-radius: 8px;
            font-weight: 600;
            display: none;
        }
        .quiz-result.show {
            display: block;
        }
        .quiz-result.correct {
            background: #d4edda;
            color: #155724;
        }
        .quiz-result.wrong {
            background: #f8d7da;
            color: #721c24;
        }
        .quiz-next-btn {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 12px;
            display: none;
        }
        .quiz-next-btn.show {
            display: block;
        }
        .quiz-close-btn {
            width: 100%;
            padding: 10px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            margin-top: 8px;
        }
    `;
    document.head.appendChild(style);

    // ========== HTML 삽입 ==========
    var html = `
        <button id="chatbot-toggle-btn" onclick="window.toggleChatbot()">
            <svg viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.38 0-2.68-.3-3.86-.84l-.28-.14-2.9.49.49-2.9-.14-.28C4.3 14.68 4 13.38 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
        </button>

        <div class="chatbot-container">
            <div id="loginArea" class="auth-area">
                <h2>🎓 Key Trend</h2>
                <p>로그인하여 시작하세요</p>
                <input type="email" id="loginEmail" placeholder="이메일" />
                <input type="password" id="loginPassword" placeholder="비밀번호" onkeypress="if(event.key==='Enter')window.chatbotLogin()" />
                <button onclick="window.chatbotLogin()">로그인</button>
                <div class="auth-toggle">
                    계정이 없으신가요? <a onclick="window.showSignupForm()">회원가입</a>
                </div>
            </div>

            <div id="signupArea" class="auth-area">
                <h2>🎓 Key Trend 회원가입</h2>
                <p>새 계정을 만드세요</p>
                <input type="text" id="signupName" placeholder="이름" />
                <input type="email" id="signupEmail" placeholder="이메일" />
                <input type="password" id="signupPassword" placeholder="비밀번호 (최소 6자)" />
                <input type="password" id="signupPasswordConfirm" placeholder="비밀번호 확인" onkeypress="if(event.key==='Enter')window.chatbotSignup()" />
                <button onclick="window.chatbotSignup()">가입하기</button>
                <div class="auth-toggle">
                    이미 계정이 있으신가요? <a onclick="window.showLoginForm()">로그인</a>
                </div>
            </div>

            <div id="chatArea">
                <div class="chatbot-header">
                    <h1>🎓 Key Trend</h1>
                    <div class="usage-info" id="usageInfo">남은 질문 횟수(간단한 질문: -, 복잡한 질문: -)</div>
                    <button onclick="window.toggleChatbot()" style="position: absolute; top: 14px; left: 16px; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 4px 10px; border-radius: 12px; font-size: 12px; cursor: pointer;">✕ 닫기</button>
                    <button class="logout-btn" onclick="window.chatbotLogout()">로그아웃</button>
                    
                    <!-- 메뉴 탭 -->
                    <div style="display: flex; gap: 5px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
                        <button onclick="window.switchTab('chat')" id="tab-chat" style="flex: 1; padding: 8px; background: rgba(255,255,255,0.3); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 13px;">
                            💬 <br> 질문하기
                        </button>
                        <button onclick="window.switchTab('vocabulary')" id="tab-vocabulary" style="flex: 1; padding: 8px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 13px;">
                            📚 <br> 단어장(<span id="vocab-count">0</span>)
                        </button>
                        <button onclick="window.switchTab('saved-problems')" id="tab-saved-problems" style="flex: 1; padding: 8px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 13px;">
                            📌 <br> 저장한 문제(<span id="problems-count">0</span>)
                        </button>
                        <button onclick="window.switchTab('wrong-answers')" id="tab-wrong-answers" style="flex: 1; padding: 8px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 13px;">
                            📝 <br> 오답노트(<span id="wrong-count">0</span>)
                        </button>
                    </div>
                </div>
                <div class="error-message" id="errorMessage"></div>
                
                <div style="margin: 15px 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
                    <div style="margin-bottom: 12px; font-weight: bold; color: #495057;">
                        💡 질문 유형을 선택하세요
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                        <button id="simpleBtn" onclick="window.selectQuestionType('simple')" 
                                style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                            간단한 질문
                        </button>
                        <button id="complexBtn" onclick="window.selectQuestionType('complex')" 
                                style="flex: 1; padding: 12px; background: #e9ecef; color: #6c757d; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                            복잡한 질문
                        </button>
                    </div>
                    <div style="font-size: 13px; color: #6c757d; line-height: 1.6;">
                        <div id="simpleDesc" style="display: block;">
                            ✓ 단어/문법 뜻 묻기<br>
                            ✓ 짧은 문장 해석<br>
                            ✓ 예: "flawlessly의 뜻은?"
                        </div>
                        <div id="complexDesc" style="display: none;">
                            ✓ 문제 풀이 전체 설명<br>
                            ✓ 긴 문단 분석 요청<br>
                            ✓ 예: "이 문제를 자세히 설명해주세요"
                        </div>
                    </div>
                </div>
                
                <div style="margin: 0 20px 10px 20px;">
                    <button class="quiz-toggle-btn" onclick="window.toggleQuiz()">
                        🎯 단어 퀴즈 풀기
                    </button>
                </div>
                
                <div class="quiz-area" id="quizArea">
                    <div class="quiz-word" id="quizWord">Loading...</div>
                    <div class="quiz-pos" id="quizPos"></div>
                    
                    <div id="quizChoices"></div>
                    
                    <div class="quiz-result" id="quizResult"></div>
                    <button class="quiz-next-btn" id="quizNextBtn" onclick="window.loadQuiz()">다음 문제</button>
                    <button class="quiz-close-btn" onclick="window.toggleQuiz()">퀴즈 닫기</button>
                </div>
                
                <!-- 단어장 영역 -->
                <div id="vocabularyArea" style="display: none; flex: 1; overflow-y: auto; padding: 16px; background: #fafafa;">
                    <button id="quiz-start-btn" onclick="window.startVocabQuiz()" style="width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-bottom: 8px;">
                        🎯 내 단어 퀴즈 시작 (<span id="quiz-word-count">0</span>개)
                    </button>
                    <button id="public-quiz-start-btn" onclick="window.startPublicQuiz()" style="width: 100%; padding: 15px; background: linear-gradient(135deg, #f093fb, #f5576c); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-bottom: 16px;">
                        🎯 수능 단어 퀴즈 (1,862개)
                    </button>
                    <div id="public-quiz-area" style="display: none;"></div>
                    <div id="quiz-area" style="display: none;"></div>
                    <div style="margin-bottom: 12px;">
                        <input type="text" id="vocabSearch" placeholder="단어 검색..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;" />
                    </div>
                    <div id="vocabularyList" style="display: flex; flex-direction: column; gap: 12px;"></div>
                    <div id="vocabEmpty" style="text-align: center; padding: 40px; color: #999;">저장된 단어가 없습니다.<br>채팅에서 단어를 저장해보세요!</div>
                </div>

                <!-- 저장한 문제 영역 -->
                <div id="savedProblemsArea" style="display: none; flex: 1; overflow-y: auto; padding: 16px; background: #fafafa;">
                    <div id="problemsList" style="display: flex; flex-direction: column; gap: 12px;"></div>
                    <div id="problemsEmpty" style="display: none; text-align: center; padding: 60px 20px; color: #999;">📌 저장된 문제가 없습니다.</div>
                </div>

                <!-- 오답노트 영역 -->
                <div id="wrongAnswersArea" style="display: none; flex: 1; overflow-y: auto; padding: 16px; background: #fafafa;">
                    <div id="wrongAnswersList" style="display: flex; flex-direction: column; gap: 12px;"></div>
                    <div id="wrongAnswersEmpty" style="display: none; text-align: center; padding: 60px 20px; color: #999;">❌ 등록된 오답이 없습니다.</div>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="message bot">
                        <div class="bubble">
                            <div class="line">안녕하세요! 👋</div>
                            <div class="line">수능 영어 질문을 자유롭게 해주세요.</div>
                            <div class="line">어휘, 문법, 독해 등 무엇이든 도와드리겠습니다!</div>
                        </div>
                        <div class="msg-time">...</div>
                    </div>
                </div>
                <div class="loading" id="loading">답변 생성 중...</div>
                <div class="chat-input-area">
                    <div class="input-wrapper">
                        <input type="text" id="questionInput" placeholder="질문을 입력하세요..." onkeypress="if(event.key==='Enter')window.sendQuestion()" />
                        <button id="sendButton" onclick="window.sendQuestion()">전송</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    var container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    // ========== 전역 변수 ==========
    window.API_URL = 'https://english-exam-chatbot.onrender.com';
    window.authToken = localStorage.getItem('authToken');
    window.selectedQuestionType = 'simple';

    // ========== 유틸리티 함수 ==========
    window.getPageContext = function() {
        var allText = document.body.innerText;
        var startIndex = allText.indexOf('정답:');
        if (startIndex === -1) {
            startIndex = allText.indexOf('[프리미엄 문제 분석]');
        }
        if (startIndex !== -1) {
            var context = allText.substring(startIndex);
            console.log('해설 추출 완료:', context.length, '글자');
            return context;
        }
        console.log('해설을 찾을 수 없습니다');
        return '';
    };

    window.getPageId = function() {
        return window.location.pathname || 'default-page';
    };

    // ========== 자동 로그인 ==========
    window.checkAutoLogin = async function() {
        var token = localStorage.getItem('authToken');
        if (!token) {
            return false;
        }

        try {
            var res = await fetch(window.API_URL + '/api/auth/verify', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });

            if (res.ok) {
                var data = await res.json();
                if (data.success) {
                    window.authToken = token;
                    window.showChatArea();
                    window.loadUsageInfo();
                    
                    if (window.pendingContext) {
                        window.cacheContext(window.pendingContext.page_id, window.pendingContext.context);
                    }
                    return true;
                }
            }
            
            localStorage.removeItem('authToken');
            return false;
        } catch(e) {
            console.error('자동 로그인 실패:', e);
            return false;
        }
    };

    // ========== 페이지 로드 시 실행 ==========
    window.addEventListener('load', async function() {
        var context = window.getPageContext();
        if (context) {
            var page_id = window.getPageId();
            console.log('페이지 로드 완료, 해설 캐싱 준비:', page_id);
            window.pendingContext = { page_id: page_id, context: context };
        }

        await window.checkAutoLogin();
    });

    // ========== 폼 전환 ==========
    window.showLoginForm = function() {
        document.getElementById('signupArea').classList.remove('visible');
        document.getElementById('loginArea').classList.remove('hidden');
    };

    window.showSignupForm = function() {
        document.getElementById('loginArea').classList.add('hidden');
        document.getElementById('signupArea').classList.add('visible');
    };

    // ========== 회원가입 ==========
    window.chatbotSignup = async function() {
        var name = document.getElementById('signupName').value.trim();
        var email = document.getElementById('signupEmail').value.trim();
        var password = document.getElementById('signupPassword').value;
        var passwordConfirm = document.getElementById('signupPasswordConfirm').value;

        if (!name || !email || !password) {
            return window.showError('모든 항목을 입력해주세요.');
        }

        if (password.length < 6) {
            return window.showError('비밀번호는 최소 6자 이상이어야 합니다.');
        }

        if (password !== passwordConfirm) {
            return window.showError('비밀번호가 일치하지 않습니다.');
        }

        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return window.showError('올바른 이메일 형식이 아닙니다.');
        }

        try {
            var res = await fetch(window.API_URL + '/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: name,
                    email: email, 
                    password: password 
                })
            });

            var data = await res.json();
            
            if (data.success && data.token) {
                window.authToken = data.token;
                localStorage.setItem('authToken', window.authToken);
                
                if (window.pendingContext) {
                    window.cacheContext(window.pendingContext.page_id, window.pendingContext.context);
                }
                
                window.showChatArea();
                window.loadUsageInfo();
                
                document.getElementById('signupName').value = '';
                document.getElementById('signupEmail').value = '';
                document.getElementById('signupPassword').value = '';
                document.getElementById('signupPasswordConfirm').value = '';
            } else {
                window.showError(data.message || '회원가입 실패');
            }
        } catch(e) {
            window.showError('서버 연결 실패');
        }
    };

    // ========== 로그인 ==========
    window.chatbotLogin = async function() {
        var email = document.getElementById('loginEmail').value.trim();
        var password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            return window.showError('이메일과 비밀번호를 모두 입력해주세요.');
        }

        try {
            var res = await fetch(window.API_URL + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: email, 
                    password: password 
                })
            });

            var data = await res.json();
            
            if (data.success && data.token) {
                window.authToken = data.token;
                localStorage.setItem('authToken', window.authToken);
                
                if (window.pendingContext) {
                    window.cacheContext(window.pendingContext.page_id, window.pendingContext.context);
                }
                
                window.showChatArea();
                window.loadUsageInfo();
                
                document.getElementById('loginEmail').value = '';
                document.getElementById('loginPassword').value = '';
            } else {
                window.showError(data.message || '로그인 실패');
            }
        } catch(e) {
            window.showError('서버 연결 실패');
        }
    };

    // ========== 로그아웃 ==========
    window.chatbotLogout = function() {
        localStorage.removeItem('authToken');
        window.authToken = null;
        document.getElementById('chatArea').classList.remove('visible');
        document.getElementById('loginArea').classList.remove('hidden');
        document.getElementById('signupArea').classList.remove('visible');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    };

    // ========== 토큰 만료 체크 ==========
    window.checkAuthError = function(res) {
        if (res.status === 401 || res.status === 403) {
            window.chatbotLogout();
            window.showError('세션이 만료되었습니다. 다시 로그인해주세요.');
            return true;
        }
        return false;
    };

    // ========== 채팅 영역 표시 ==========
    window.showChatArea = function() {
        document.getElementById('loginArea').classList.add('hidden');
        document.getElementById('signupArea').classList.remove('visible');
        document.getElementById('chatArea').classList.add('visible');
        
        // 탭 카운트 로드
        setTimeout(function() {
            window.loadVocabularyList();
            window.loadSavedProblemsList();
            window.loadWrongAnswersList();
        }, 500);
    };

    // ========== 캐싱 함수 ==========
    window.cacheContext = async function(page_id, context) {
        try {
            var res = await fetch(window.API_URL + '/api/cache-context', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + window.authToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ page_id: page_id, context: context })
            });
            var data = await res.json();
            if (data.success) {
                console.log('캐싱 완료:', data.cached_length, '글자');
            }
        } catch(e) {
            console.error('캐싱 오류:', e);
        }
    };

    // ========== 질문 유형 선택 ==========
    window.selectQuestionType = function(type) {
        window.selectedQuestionType = type;
        
        var simpleBtn = document.getElementById('simpleBtn');
        var complexBtn = document.getElementById('complexBtn');
        var simpleDesc = document.getElementById('simpleDesc');
        var complexDesc = document.getElementById('complexDesc');
        
        if (type === 'simple') {
            simpleBtn.style.background = '#28a745';
            simpleBtn.style.color = 'white';
            complexBtn.style.background = '#e9ecef';
            complexBtn.style.color = '#6c757d';
            simpleDesc.style.display = 'block';
            complexDesc.style.display = 'none';
        } else {
            simpleBtn.style.background = '#e9ecef';
            simpleBtn.style.color = '#6c757d';
            complexBtn.style.background = '#007bff';
            complexBtn.style.color = 'white';
            simpleDesc.style.display = 'none';
            complexDesc.style.display = 'block';
        }
    };

    // ========== 사용량 로드 ==========
    window.loadUsageInfo = async function() {
        try {
            var res = await fetch(window.API_URL + '/api/usage', {
                headers: { 'Authorization': 'Bearer ' + window.authToken }
            });
            if (window.checkAuthError(res)) return;
            var data = await res.json();
            if (data['성공']) {
                document.getElementById('usageInfo').textContent =
                    '남은 질문 횟수(간단한 질문: ' + data['이번달']['간단한질문']['남음'] +
                    ', 복잡한 질문: ' + data['이번달']['복잡한질문']['남음'] + ')';
            }
        } catch(e) { 
            console.error(e); 
        }
    };

    // ========== 질문 전송 ==========
    window.sendQuestion = async function() {
        var input = document.getElementById('questionInput');
        var question = input.value.trim();
        if (!question) return;

        window.addMessage(question, 'user');
        input.value = '';
        document.getElementById('sendButton').disabled = true;
        document.getElementById('loading').classList.add('active');

        try {
            var res = await fetch(window.API_URL + '/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': 'Bearer ' + window.authToken 
                },
                body: JSON.stringify({ 
                    question: question, 
                    questionType: window.selectedQuestionType,
                    page_id: window.getPageId()
                })
            });
            
            if (window.checkAuthError(res)) return;
            
            var data = await res.json();
            if (data.answer) {
                window.addMessage(data.answer, 'bot');
                window.loadUsageInfo();
            } else {
                window.showError(data.message || '답변을 받지 못했습니다.');
            }
        } catch(e) {
            window.showError('서버 연결 실패');
        } finally {
            document.getElementById('sendButton').disabled = false;
            document.getElementById('loading').classList.remove('active');
        }
    };

    // ========== Markdown → HTML 변환 ==========
    window.formatMessage = function(rawText) {
        var text = rawText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/#{1,6}\s+(.*)/g, '**$1**');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '<em>$1</em>');
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

        var lines = text.split('\n');
        var html = '';

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            if (line === '') { 
                html += '<div class="gap"></div>'; 
                continue; 
            }
            
            if (/^[-_*]{3,}$/.test(line)) { 
                html += '<div class="divider"></div>'; 
                continue; 
            }

            var numM = line.match(/^(\d+)[.)]\s+([\s\S]*)/);
            if (numM) {
                html += '<div class="line">📌 <strong>' + numM[1] + '.</strong> ' + numM[2] + '</div>';
                continue;
            }

            var bulM = line.match(/^[-•]\s+([\s\S]*)/);
            if (bulM) {
                html += '<div class="line">• ' + bulM[1] + '</div>';
                continue;
            }

            var titM = line.match(/^(<strong>[^<]+<\/strong>)\s*:?\s*$/);
            if (titM) {
                var ni = i + 1;
                while (ni < lines.length && lines[ni].trim() === '') ni++;

                if (ni < lines.length) {
                    var nextLine = lines[ni].trim();
                    var nextIsList = /^[-•]\s/.test(nextLine) || /^\d+[.)]\s/.test(nextLine);
                    var nextIsTitle = /^<strong>/.test(nextLine);

                    if (!nextIsList && !nextIsTitle && !/^[-_*]{3,}$/.test(nextLine)) {
                        html += '<div class="line">' + titM[1] + ': ' + nextLine + '</div>';
                        i = ni;
                        continue;
                    }
                }
                html += '<div class="gap"></div>';
                html += '<div class="line">' + titM[1] + '</div>';
                continue;
            }

            html += '<div class="line">' + line + '</div>';
        }

        return html;
    };

    // ========== 메시지 추가 ==========
    window.addMessage = function(text, sender) {
        var container = document.getElementById('chatMessages');

        var msgDiv = document.createElement('div');
        msgDiv.className = 'message ' + sender;

        var bubble = document.createElement('div');
        bubble.className = 'bubble';

        if (sender === 'bot') {
            bubble.innerHTML = window.formatMessage(text);
        } else {
            bubble.textContent = text;
        }

        var timeDiv = document.createElement('div');
        timeDiv.className = 'msg-time';
        timeDiv.textContent = new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        msgDiv.appendChild(bubble);
        msgDiv.appendChild(timeDiv);
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    };

    // ========== 에러 표시 ==========
    window.showError = function(msg) {
        var el = document.getElementById('errorMessage');
        // If chatArea is not visible (login/signup screen), use alert
        var chatArea = document.getElementById('chatArea');
        if (!chatArea || !chatArea.classList.contains('visible')) {
            alert('⚠️ ' + msg);
            return;
        }
        el.textContent = msg;
        el.classList.add('active');
        setTimeout(function() { 
            el.classList.remove('active'); 
        }, 5000);
    };

    // ========== 챗봇 토글 ==========
    window.toggleChatbot = function() {
        var container = document.querySelector('.chatbot-container');
        var toggleBtn = document.getElementById('chatbot-toggle-btn');
        container.classList.toggle('open');
        
        if (container.classList.contains('open')) {
            localStorage.setItem('chatbotOpen', 'true');
            if (toggleBtn) toggleBtn.style.display = 'none';
        } else {
            localStorage.setItem('chatbotOpen', 'false');
            if (toggleBtn) toggleBtn.style.display = 'flex';
            // 전체화면 해제
            container.classList.remove('fullscreen');
        }
    };

    // ========== 전체 화면 토글 (더블클릭) ==========
    window.toggleFullscreen = function() {
        var container = document.querySelector('.chatbot-container');
        container.classList.toggle('fullscreen');
    };

    // ========== 드래그 기능 (PC만) ==========
    setTimeout(function() {
        var isMobile = window.innerWidth <= 480;
        if (isMobile) return;

        var chatContainer = document.querySelector('.chatbot-container');
        if (!chatContainer) return;

        var isDragging = false;
        var startX, startY, containerLeft, containerTop;

        function setInitialPosition() {
            var windowWidth = window.innerWidth;
            var windowHeight = window.innerHeight;
            var containerWidth = 400;
            var containerHeight = Math.min(600, windowHeight - 40);
            var initialLeft = windowWidth - containerWidth - 20;
            var initialTop = windowHeight - containerHeight - 90;
            if (initialTop < 20) initialTop = 20;
            chatContainer.style.left = initialLeft + 'px';
            chatContainer.style.top = initialTop + 'px';
            chatContainer.style.right = 'auto';
            chatContainer.style.bottom = 'auto';
            chatContainer.style.transform = 'none';
        }

        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class' && chatContainer.classList.contains('open') && !chatContainer.classList.contains('fullscreen')) {
                    setInitialPosition();
                }
            });
        });
        observer.observe(chatContainer, { attributes: true });

        chatContainer.addEventListener('mousedown', function(e) {
            var target = e.target;
            if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
                target.closest('.chat-messages') || target.closest('.chat-input-area') || target.closest('.error-message') ||
                target.closest('#vocabularyArea') || target.closest('#savedProblemsArea') || target.closest('#wrongAnswersArea')) {
                return;
            }
            if (chatContainer.classList.contains('fullscreen')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            var rect = chatContainer.getBoundingClientRect();
            containerLeft = rect.left;
            containerTop = rect.top;
            chatContainer.style.transition = 'none';
            chatContainer.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
            var deltaX = e.clientX - startX;
            var deltaY = e.clientY - startY;
            chatContainer.style.left = (containerLeft + deltaX) + 'px';
            chatContainer.style.top = (containerTop + deltaY) + 'px';
        });

        document.addEventListener('mouseup', function() {
            if (!isDragging) return;
            isDragging = false;
            chatContainer.style.cursor = 'move';
        });

        // 더블클릭으로 전체화면 토글
        var header = chatContainer.querySelector('.chatbot-header');
        if (header) {
            header.addEventListener('dblclick', function(e) {
                if (e.target.tagName === 'BUTTON') return;
                window.toggleFullscreen();
            });
            header.title = '더블클릭하면 전체 화면';
        }
    }, 500);

    // ========== 탭 전환 ==========
    window.switchTab = function(tab) {
        localStorage.setItem('activeTab', tab);
        var chatArea = document.querySelector('.chat-messages');
        var vocabArea = document.getElementById('vocabularyArea');
        var problemsArea = document.getElementById('savedProblemsArea');
        var wrongAnswersArea = document.getElementById('wrongAnswersArea');
        var chatBtn = document.getElementById('tab-chat');
        var vocabBtn = document.getElementById('tab-vocabulary');
        var problemsBtn = document.getElementById('tab-saved-problems');
        var wrongAnswersBtn = document.getElementById('tab-wrong-answers');
        var questionTypeBox = document.getElementById('questionTypeBox');
        var chatInputArea = document.querySelector('.chat-input-area');
        var quizToggleBtn = document.querySelector('.quiz-toggle-btn');
        var quizAreaOld = document.getElementById('quizArea');

        // 모든 숨기기
        if (chatArea) chatArea.style.display = 'none';
        if (vocabArea) vocabArea.style.display = 'none';
        if (problemsArea) problemsArea.style.display = 'none';
        if (wrongAnswersArea) wrongAnswersArea.style.display = 'none';

        // 탭 버튼 초기화
        [chatBtn, vocabBtn, problemsBtn, wrongAnswersBtn].forEach(function(btn) {
            if (btn) btn.style.background = 'rgba(255,255,255,0.1)';
        });

        if (tab === 'chat') {
            if (chatArea) chatArea.style.display = 'block';
            if (chatBtn) chatBtn.style.background = 'rgba(255,255,255,0.3)';
            if (chatInputArea) chatInputArea.style.display = 'block';
            if (questionTypeBox) questionTypeBox.style.display = 'block';
            if (quizToggleBtn) quizToggleBtn.style.display = 'block';
            if (quizAreaOld) quizAreaOld.style.display = quizAreaOld.classList.contains('active') ? 'block' : 'none';
        } else if (tab === 'vocabulary') {
            if (vocabArea) vocabArea.style.display = 'block';
            if (vocabBtn) vocabBtn.style.background = 'rgba(255,255,255,0.3)';
            if (chatInputArea) chatInputArea.style.display = 'none';
            if (questionTypeBox) questionTypeBox.style.display = 'none';
            if (quizToggleBtn) quizToggleBtn.style.display = 'none';
            if (quizAreaOld) quizAreaOld.style.display = 'none';
            window.loadVocabularyList();
        } else if (tab === 'saved-problems') {
            if (problemsArea) problemsArea.style.display = 'block';
            if (problemsBtn) problemsBtn.style.background = 'rgba(255,255,255,0.3)';
            if (chatInputArea) chatInputArea.style.display = 'none';
            if (questionTypeBox) questionTypeBox.style.display = 'none';
            if (quizToggleBtn) quizToggleBtn.style.display = 'none';
            if (quizAreaOld) quizAreaOld.style.display = 'none';
            window.loadSavedProblemsList();
        } else if (tab === 'wrong-answers') {
            if (wrongAnswersArea) wrongAnswersArea.style.display = 'block';
            if (wrongAnswersBtn) wrongAnswersBtn.style.background = 'rgba(255,255,255,0.3)';
            if (chatInputArea) chatInputArea.style.display = 'none';
            if (questionTypeBox) questionTypeBox.style.display = 'none';
            if (quizToggleBtn) quizToggleBtn.style.display = 'none';
            if (quizAreaOld) quizAreaOld.style.display = 'none';
            window.loadWrongAnswersList();
        }
    };

    // ========== 단어장 로드 ==========
    window.loadVocabularyList = async function() {
        try {
            var res = await fetch(window.API_URL + '/api/vocabulary/list', {
                headers: { 'Authorization': 'Bearer ' + window.authToken },
                credentials: 'omit'
            });
            if (res.status === 401 || res.status === 403) return;
            var data = await res.json();
            var listEl = document.getElementById('vocabularyList');
            var emptyEl = document.getElementById('vocabEmpty');
            var countEl = document.getElementById('vocab-count');
            var quizCountEl = document.getElementById('quiz-word-count');

            if (data.words && data.words.length > 0) {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.style.display = 'none';
                data.words.forEach(function(word) {
                    var card = document.createElement('div');
                    card.style.cssText = 'background: white; padding: 16px; border-radius: 8px; border: 1px solid #e0e0e0;';
                    card.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                        '<div><span style="font-weight: bold; color: #667eea;">' + word.word + '</span> - ' + (word.meaning || '') + '</div>' +
                        '<button onclick="window.deleteVocab(' + word.id + ')" style="background: #dc3545; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button></div>';
                    listEl.appendChild(card);
                });
                if (countEl) countEl.textContent = data.words.length;
                if (quizCountEl) quizCountEl.textContent = data.words.length;
            } else {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.style.display = 'block';
                if (countEl) countEl.textContent = '0';
                if (quizCountEl) quizCountEl.textContent = '0';
            }
        } catch(e) {
            console.error('단어장 로드 오류:', e);
        }
    };

    // ========== 단어 삭제 ==========
    window.deleteVocab = async function(id) {
        if (!confirm('이 단어를 삭제하시겠습니까?')) return;
        try {
            var res = await fetch(window.API_URL + '/api/vocabulary/' + id, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + window.authToken },
                credentials: 'omit'
            });
            var data = await res.json();
            if (data.success) {
                alert('✅ 삭제되었습니다!');
                window.loadVocabularyList();
            }
        } catch(e) { alert('❌ 삭제 실패'); }
    };

    // ========== 저장한 문제 로드 ==========
    window.loadSavedProblemsList = async function() {
        try {
            var res = await fetch(window.API_URL + '/api/saved-problems/list', {
                headers: { 'Authorization': 'Bearer ' + window.authToken },
                credentials: 'omit'
            });
            if (res.status === 401 || res.status === 403) return;
            var data = await res.json();
            var listEl = document.getElementById('problemsList');
            var emptyEl = document.getElementById('problemsEmpty');
            var countEl = document.getElementById('problems-count');

            if (data.problems && data.problems.length > 0) {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.style.display = 'none';
                data.problems.forEach(function(p) {
                    var card = document.createElement('div');
                    card.style.cssText = 'background: white; padding: 16px; border-radius: 8px; border: 1px solid #e0e0e0;';
                    var courseDisplay = (p.course_name || '').replace(/_/g, ' ');
                    card.innerHTML = '<div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><div style="color: #667eea; font-weight: bold;">📝 ' + courseDisplay + ' - ' + p.problem_number + '번</div>' +
                        '<button onclick="window.deleteProblem(' + p.id + ')" style="background: #dc3545; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button></div>' +
                        '<a href="' + p.problem_url + '" style="display: block; padding: 8px; background: #f0f3ff; border-radius: 6px; text-decoration: none; color: #667eea; text-align: center;">🔗 문제 보러가기</a>';
                    listEl.appendChild(card);
                });
                if (countEl) countEl.textContent = data.problems.length;
            } else {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.style.display = 'block';
                if (countEl) countEl.textContent = '0';
            }
        } catch(e) { console.error('문제 로드 오류:', e); }
    };

    window.deleteProblem = async function(id) {
        if (!confirm('삭제하시겠습니까?')) return;
        try {
            var res = await fetch(window.API_URL + '/api/saved-problems/' + id, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + window.authToken },
                credentials: 'omit'
            });
            var data = await res.json();
            if (data.success) { alert('✅ 삭제!'); window.loadSavedProblemsList(); }
        } catch(e) { alert('❌ 삭제 실패'); }
    };

    // ========== 오답노트 로드 ==========
    window.loadWrongAnswersList = async function() {
        try {
            var res = await fetch(window.API_URL + '/api/wrong-answers/list', {
                headers: { 'Authorization': 'Bearer ' + window.authToken },
                credentials: 'omit'
            });
            if (res.status === 401 || res.status === 403) return;
            var data = await res.json();
            var listEl = document.getElementById('wrongAnswersList');
            var emptyEl = document.getElementById('wrongAnswersEmpty');
            var countEl = document.getElementById('wrong-count');

            if (data.wrongAnswers && data.wrongAnswers.length > 0) {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.style.display = 'none';
                data.wrongAnswers.forEach(function(a) {
                    var card = document.createElement('div');
                    card.style.cssText = 'background: white; padding: 16px; border-radius: 8px; border: 1px solid #ffcdd2; border-left: 4px solid #fc6c85;';
                    var courseDisplay = (a.course_name || '').replace(/_/g, ' ');
                    card.innerHTML = '<div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><div style="color: #fc6c85; font-weight: bold;">❌ ' + courseDisplay + ' - ' + a.problem_number + '번</div>' +
                        '<button onclick="window.deleteWrongAnswer(' + a.id + ')" style="background: #dc3545; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button></div>' +
                        '<div style="background: #fff3e0; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 14px;">💭 ' + (a.wrong_reason || '') + '</div>' +
                        '<a href="' + a.problem_url + '" style="display: block; padding: 8px; background: #f0f3ff; border-radius: 6px; text-decoration: none; color: #667eea; text-align: center;">🔗 다시 풀기</a>';
                    listEl.appendChild(card);
                });
                if (countEl) countEl.textContent = data.wrongAnswers.length;
            } else {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.style.display = 'block';
                if (countEl) countEl.textContent = '0';
            }
        } catch(e) { console.error('오답 로드 오류:', e); }
    };

    window.deleteWrongAnswer = async function(id) {
        if (!confirm('삭제하시겠습니까?')) return;
        try {
            var res = await fetch(window.API_URL + '/api/wrong-answers/' + id, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + window.authToken },
                credentials: 'omit'
            });
            var data = await res.json();
            if (data.success) { alert('✅ 삭제!'); window.loadWrongAnswersList(); }
        } catch(e) { alert('❌ 삭제 실패'); }
    };

    // ========== 수능 단어 퀴즈 (탭에서 시작) ==========
    window.startPublicQuiz = function() {
        alert('수능 단어 퀴즈는 단어장 탭의 🎯 수능 단어 퀴즈 버튼을 눌러주세요.');
    };

    window.startVocabQuiz = function() {
        alert('내 단어 퀴즈 기능은 단어를 먼저 저장한 후 사용할 수 있습니다.');
    };

    // ========== 챗봇 상태 복원 ==========
    setTimeout(function() {
        var chatbotOpen = localStorage.getItem('chatbotOpen');
        if (chatbotOpen === 'true') {
            document.querySelector('.chatbot-container').classList.add('open');
            var toggleBtn = document.getElementById('chatbot-toggle-btn');
            if (toggleBtn) toggleBtn.style.display = 'none';
            var activeTab = localStorage.getItem('activeTab');
            if (activeTab && activeTab !== 'chat') {
                window.switchTab(activeTab);
            }
        }
    }, 200);

    // ========== 퀴즈 토글 ==========
    window.toggleQuiz = function() {
        var quizArea = document.getElementById('quizArea');
        if (!quizArea) return;
        var isActive = quizArea.classList.contains('active');
        
        if (isActive) {
            quizArea.classList.remove('active');
        } else {
            quizArea.classList.add('active');
            window.loadQuiz();
        }
    };

    // ========== 퀴즈 로드 ==========
    window.loadQuiz = async function() {
        if (!window.authToken) {
            window.showError('로그인이 필요합니다');
            return;
        }
        
        try {
            document.getElementById('quizResult').className = 'quiz-result';
            document.getElementById('quizNextBtn').className = 'quiz-next-btn';
            
            var res = await fetch(window.API_URL + '/api/quiz/random', {
                headers: { 'Authorization': 'Bearer ' + window.authToken }
            });
            
            if (window.checkAuthError(res)) return;
            
            var data = await res.json();
            
            if (data.success && data.quiz) {
                window.displayQuiz(data.quiz);
            } else {
                window.showError(data.message || '퀴즈를 불러올 수 없습니다');
            }
        } catch(e) {
            console.error('퀴즈 로드 오류:', e);
            window.showError('퀴즈 로드 실패');
        }
    };

    // ========== 퀴즈 표시 ==========
    window.displayQuiz = function(quiz) {
        document.getElementById('quizWord').textContent = quiz.word;
        document.getElementById('quizPos').textContent = quiz.part_of_speech ? 
            '(' + quiz.part_of_speech + ')' : '';
        
        var choicesContainer = document.getElementById('quizChoices');
        choicesContainer.innerHTML = '';
        
        quiz.choices.forEach(function(choice, index) {
            var choiceDiv = document.createElement('div');
            choiceDiv.className = 'quiz-choice';
            choiceDiv.textContent = (index + 1) + '. ' + choice;
            choiceDiv.onclick = function() {
                window.selectAnswer(index, quiz.correct_index, quiz.choices);
            };
            choicesContainer.appendChild(choiceDiv);
        });
        
        window.currentQuizAnswer = quiz.correct_index;
    };

    // ========== 퀴즈 답변 선택 ==========
    window.selectAnswer = function(selectedIndex, correctIndex, choices) {
        var allChoices = document.querySelectorAll('.quiz-choice');
        allChoices.forEach(function(choice) {
            choice.classList.add('disabled');
            choice.onclick = null;
        });
        
        var isCorrect = selectedIndex === correctIndex;
        
        allChoices[selectedIndex].classList.add(isCorrect ? 'correct' : 'wrong');
        allChoices[correctIndex].classList.add('correct');
        
        var resultDiv = document.getElementById('quizResult');
        resultDiv.className = 'quiz-result show ' + (isCorrect ? 'correct' : 'wrong');
        resultDiv.textContent = isCorrect ? 
            '🎉 정답입니다!' : 
            '❌ 틀렸습니다! 정답: ' + choices[correctIndex];
        
        document.getElementById('quizNextBtn').classList.add('show');
    };

})();
