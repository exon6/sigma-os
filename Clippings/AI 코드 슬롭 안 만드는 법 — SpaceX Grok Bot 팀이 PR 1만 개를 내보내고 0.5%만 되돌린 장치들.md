---
title: "AI 코드 슬롭 안 만드는 법 — SpaceX Grok Bot 팀이 PR 1만 개를 내보내고 0.5%만 되돌린 장치들"
source: "https://www.youtube.com/watch?v=ueA116hO_ho"
author:
  - "[[AgentOS]]"
published: 2026-11-15
created: 2026-11-20
description: "원본 영상All Code Is Slop (Except Mine) — Lauren Tan, SpaceXSI (AI Engineer)https://youtu.be/O_zcc6Xl12gpstack 저장소pstack — https://github.com/cursor/plugins/tree/main/pstack타임라인0:00 발표 소개 · 한 달 PR"
tags:
  - "clippings"
---
![](https://www.youtube.com/watch?v=ueA116hO_ho)

원본 영상  
All Code Is Slop (Except Mine) — Lauren Tan, SpaceXSI (AI Engineer)  
https://youtu.be/O\_zcc6Xl12g  
  
pstack 저장소  
pstack — https://github.com/cursor/plugins/tree/main/pstack  
  
타임라인  
0:00 발표 소개 · 한 달 PR 11,000개와 되돌림 0.5%  
2:40 포테이토 피라미드 다섯 칸  
4:04 맨 위 칸, 코드베이스 · 정원 비유  
6:27 Dune 의 제약 두 가지  
8:53 날짜 세 개 · 주석 99% 금지  
12:01 가장 중요한 칸, 검증 · 런타임 검증  
13:46 형식 검증과 속성 기반 테스트  
15:17 트윗 두 장 · 토큰 70% 가 검증으로  
17:09 그래서 무엇을 얻었나 · 팀 숫자  
19:24 소프트웨어 공장보다 먼저  
20:42 릴리스마다 벌어지는 일 · 퍼징  
22:07 정리 · 내 코드베이스에 넣을 것

## Transcript

### 발표 소개 · 한 달 PR 11,000개와 되돌림 0.5

**0:00** · 10월 한 달 동안 한 팀이 병합한 PR이 약 2만 개, 정확히는 19,26개예요. 같은 달에 되돌린 커밋은 0.5% 안팎이었고요. 그록 봇이라는 제품을 만드는 팀의 엔지니어 로렌타니 발표에서 보여준 숫자예요.

**0:11** · 발표 제목은 모든 코드는 슬롭이다, 내 것만 빼고 에요. 슬롭은 AI가 대충 찍어낸 질 낮은 결과물을 가리키는 말이에요. AI 엔지니어 코드 서밋 무대에서 한 17분짜리 발표고 로렌타는 스스로를 포테이토라는 닉네임으로 소개해요. 이 영상에서는 에이전트가 쓴 코드를 믿을 수 있게 만드는 장치들을 봅니다. 프롬프트나 규칙 파일이 아니라 코드 베이스 쪽에 넣는 것들이라 내 저장소에도 오늘 하나쯤 넣어 볼 수 있어요. 발표 뒤쪽에는 로렌타니 직접 만든 플러그인과 자기 팀 제품 이야기도 섞여 있어요. 영상 중간중간 발표 클립이 들어갑니다. 한국어 자막 같이 띄울게요. 발표 초반에 막대 그래프가 하나 나오는데 팀이 아니라 로렌타 한 사람이 달마다 올린 PR 수예요.

**0:44** · 3월에는 68개였어요. 그다음에 로렌타는 이런 방식을 흔히 부르는 소프트웨어 공장이라는 말 대신 다른 단어 하나를 골라요.

**2:07** · \[목을 가다듬음\] 여섯 달이 걸렸다고 했죠. 마지막 화면에는 고리가 두 개 있었어요.

### 포테이토 피라미드 다섯 칸

**2:44** · 왼쪽 저 신뢰 고리에서는 에이전트가 슬롭을 쓰고 사람이 검증하다가 문제를 찾아요. 오른쪽 고 신뢰 고리에서는 에이전트가 좋은 코드를 쓰고 검증도 에이전트가 해요. 왼쪽에서 오른쪽으로 가려면 에이전트의 환경 어디에 시간을 써야 할까요? 로렌타는 그림 한 장으로 답해요. 거꾸로 선 삼각형이고 화면에 적힌 이름은 포테이토 피라미드예요. 위에서부터 코드 베이스, 정적 분석, 검증, 산문, 사람 리뷰 순서로 다섯 칸이에요.

**3:06** · 위가 넓고 아래가 좁은 데는 이유가 있어요.

### 맨 위 칸, 코드베이스 · 정원 비유

**4:05** · 규칙 파일이나 스킬, 에이전트 MD 같은 글은 아래쪽 좁은 칸이었어요.

**4:08** · 판단이 필요한 것만 조금 적는 자리라는 거죠. 전에 다룬 엔트로픽 리디아 할리의 발표도 클로드 MD 감정 문구를 싹 치발란 얘기였는데 방향이 같아요. 로렌타는 가장 넓은 맨 윗칸 코드 베이스부터 내려가요.

**4:19** · 이 대목에는 숫자 두 개가 나와요. 2024년에 출근해서 리뷰하던 동료 피어스와 지금의 수예요. 나무로 뒤덮인 건물 그림도 한 장 나와요. 로렌타는 그 그림의 코드 베이스를 빗대요.

### Dune 의 제약 두 가지

**6:27** · 땜질 하나가 복사되고 또 복사돼서 패턴이 된다는 그림이었어요. 그러면 실제로는 어떻게 막았을까요? 로렌탄 팀은 그록봇을 만들면서 듄이라는 자체 프레임워크를 쓴다고 해요. 예시는 두 개고 둘 다 프론트엔드 이야기예요.

**6:38** · 첫 번째 나오는 유즈 이펙트는 쓸 수는 있지만 제대로 쓰기가 까다로운 기능 정도로 들으시면 돼요. 두 번째는 화면을 그리는 쪽 코드와 뒤에서 일하는 쪽 코드가 섞이면 앱이 버벅인다는 얘기예요. 백엔드로 치면 서로 다른 프로세스에서 도는 모듈끼리 서로 가져다 쓰지 못하게 경계를 막아두는 것과 비슷해요. 겉보기엔 다른 두 예시가 한 지점에서 만나요.

### 날짜 세 개 · 주석 99% 금지

**8:53** · 쓰기 까다로운 건 제품 코드에서 아예 못 쓰게 했고, 섞이면 안 되는 건 폴더와 린트로 갈라놨어요. 두 경우 모두 리뷰에서 다시 볼 일이 없어졌다고 해요. 다음 대목에는 화면에 날짜 세 개가 차례로 나와요.

**9:03** · 9월 9일, 10월 3일, 10월 17일. 커서에서 있었던 일이라고 해요. 여기 나오는 셋 타임아웃은 이 코드를 조금 이다가 실행하라고 미뤄 두는 타이머예요. 9월 9일에는 화면 깜빡임을 고치려고 넣은 한 줄이었어요. 그 한 줄 위에 빨간 글씨가 붙어 있었는데 10월 17일에는 그게 어떻게 됐을까요?

**10:07** · actually made if the client and the agent performance much worse. And if you've ever done any performance work in JavaScript, you'll know that when you have tons of timers being rapidly created and destroyed causes a lot of uh major garbage collection which causes a lot of lag and junk. Uh but the worst part is that agents wrote a lot of code comments like you can see in red here explaining why this quick fix was justified.

**10:33** · And before you know it, we had timers spreading everywhere and the you know the performance of the app really suffered. Now in Graph Bot uh we learned a lesson there and we decided to just ban 99% of comments uh because they go stale easily. Uh you know humans just really don't bother reading the comment slot anyway. And again it gives an agent the an escape patch to justify not doing the right thing because it's hard.

**11:03** · Um and the worst part about comments though is that they're not enforceable. So what seems well-intentioned, you know like I'm going to tell the the next agent not to do something, never ends up actually being anything that you can trust.

**11:16** · So in Graph Bot and Dune and in Dune uh we now have lint rules that give uh good and very helpful error messages telling the agent to fix the root cause, the real problem uh rather than just patch around it.

**11:32** · And so our general principle is that every time we correct our agents, it turns into one of these deterministic checks or we think about how to categorically eliminate that problem in the code through better API design, through better architecture. And if you do this enough times, you'll find that you have just less things to look out for in code review.

**11:52** · And at some point you'll realize there's there's nothing left to review. And you can just let agents merge their most of their own pull requests.

### 가장 중요한 칸, 검증 · 런타임 검증

**12:01** · 주석은 7월 말 65,824개에서 지금 1,227개가 됐어요. 계단 모양 그래프는 7월에 7에서 시작해 167까지 올라가요. 축 이름은 따로 없지만 에이전트를 교정할 때마다 린트나 설계를 옮긴다는 원칙을 말하는 대목에 나온 그래프예요. 화면 아래에 작게 지나간 노 코멘츠는 로렌탄이 만든 피스택 플러그인에 들어 있는 스킬 이름이에요. 여기까지가 피라미드의 위쪽한 코드 베이스와 정적

**12:21** · 분석이었어요. 로렌탄이 가장 중요한 단계라고 부르는 건 세 번째 칸 검증이에요. 이 데모 끝에는 터미널 명령어 세 줄이 나와요. 앱에서 설정 버튼을 누르고 화면 상태를 찍고 스크린샷을 증거 파일로 남기는 명령어예요. 에이전트가 PR 대부분을 스스로 병합한다면 사람은 무엇을 볼까요?

### 형식 검증과 속성 기반 테스트

**13:46** · 사람이 보는 건 코드가 아니라 검증의 증거였어요. 영상, 스크린샷, 다이어그램 같은 것들이요. 에이전트가 실제 앱을 직접 돌려보고 그 증거를 남기는 게 런타임 검증이고요.

**13:54** · 다음에는 낯선 이름이 세 개 나와요.

**13:56** · TLA 플러스는 시스템이 가질 수 있는 상태를 전부 펼쳐놓고 빠뜨린 경우가 없는지 기계가 따져보게 하는 도구예요. 린은 알고리즘이 맞다는 걸 수학 증명처럼 한 단계씩 확인하는 도구고요. 속성 기반 테스트는 예시를 몇 개 손으로 적는 대신 어떤 입력이 와도 지켜져야 하는 조건을 적어두고 입력을 무작위로 쏟아붓는 방식이에요.

**14:12** · 로렌탄 팀은 이걸 각각 어디에 썼고 스스로 어디까지라고 선을 그어요.

### 트윗 두 장 · 토큰 70% 가 검증으로

**15:17** · 로렌타는 아니고 층을 하나 더 쌓은 거라고 했죠. 마지막에 나온 본 바디는 화면에 저장소 주소가 같이 적혀 있었어요. 여기서 로렌타는 트윗 두 장을 보여 줘요. 신디 3 나란히 여섯 달쯤 간격을 두고 쓴 글이에요.

**15:28** · 5월의 트윗은 미묘한 버그가 있는 AI 생성 PR 여러 개가 병합됐다는 내용이에요. 그걸 고치느라 며칠이 더 들고 수작업 검증도 많이 필요했다고 해요. 11월의 트윗에는 하루에 쓰는 토큰이 어디로 가는지에 관한 숫자가 나와요.

**16:19** · These are just good software engineering tools, but one step might have been prohibitively expensive to use before as they were hard to understand or write or maintain. But agents drastically cut this cost down and really we're entering a golden age of software testing and verification because agents let us test everything to a much greater degree than used to be economical.

**16:43** · And then formal verification can also help you better reason about how your product should work and whether your agents really understand your intent and goals. Uh I made this new skill called state chart uh in my plugin P sack, potato sack, uh which helps you visualize state machines from uh from the user's point of view. Uh and it's I find this much easier to review alongside the videos and screenshots that we provide.

**17:07** · Um and so that's been great.

### 그래서 무엇을 얻었나 · 팀 숫자

**17:09** · 하루 토큰의 70%가 검증으로 간다는 얘기였어요. 끝에 나온 스테이트 차트도 피스택에 들어있는 스킬이고 로렌탄이 직접 만든 거예요.

**17:16** · 여기까지가 투자예요. 코드 베이스를 정리하고 교정을 린트로 옮기고 검증을 여러 겹으로 쌓는 일이에요. 그럼 돌아온 건 뭘까요? 차트가 다섯 장 연달아 나와요. 앞에 세 장은 팀이 병합한 PR 수, 데스크톱 앱 릴리스 횟수, 기여한 사람 수예요. 기여자 차트에서 막대의 색은 한 사람이 올린 PR 수에 따라 나는 거예요. 이 속도에서 되돌림 비율은 어떻게 움직였는지가 네 번째 차트, 앱 성능은 어떻게 됐는지가 다섯 번째 표예요.

### 소프트웨어 공장보다 먼저

**19:24** · 성능표 아래에 있는 작은 글씨가 한 줄 있었어요. 일렉트론 앱에는 천장이 있고 러스트로 다시 쓰는 것도 생각해 보는 중이라는 내용이에요. 이 숫자들은 발표에서 로렌탄 팀이 직접 제시한 값이라 제가 따로 확인할 수 있는 자료는 없었어요. 릴리스는 말로는 하루에 한 번쯤이라고 했는데 슬라이드에 적힌 릴리스 간격 중앙값은 9월 25시간, 10월 28시간이에요. 그러면 이 결과를 보고 자동화부터 시작하면 될까요?

**19:45** · 로렌탄의 답은 순서에 관한 거예요.

### 릴리스마다 벌어지는 일 · 퍼징

**20:42** · 코드를 쓰는 안쪽 루프가 슬롭을 내고 있으며 그 루프를 자동화해도 슬롭만 더 많이 나온다는 거죠. 그래서 새로 생기는 안티 패턴을 린트로 먼저 막고 이미 있는 건 그 다음에 치우라는 순서였어요. 이 기초 위에 로렌탄 팀이 올린 것이 마지막 예시예요.

**20:54** · 로렌탄은 자기 팀 제품인 그록봇을 이 바깥 루프로 쓰라고 권해요. X에 올라온 피드백이나 이슈 티켓, 슬랙 메시지, 모니터링 알림 같은 신호가 들어오면 그록봇이 에이전트를 띄워서 일을 시작하는 그림이에요. 마지막 예시에 나오는 퍼징은 앱에 온갖 입력과 조작을 마구 던져서 깨지는 곳을 찾는 테스트예요. 화면의 슬랙 스레드는 그 결과 보고고요. 새 릴리스를 낼 때마다 이런 일이 벌어진다고 해요.

### 정리 · 내 코드베이스에 넣을 것

**22:08** · 발표는 처음 제목으로 돌아가서 끝나요. 마지막 슬라이드에서는 괄호 안에 말이 내 것만 빼고 해서 여러분 것만 빼고로 바뀌어 있어요. 오늘 내 저장소에 넣어 볼 수 있는 건 크지 않은 일이에요. 에이전트가 같은 실수를 해서 또 고쳐줬다면 규칙 파일에 한 줄을 보태기 전에 그걸 린트 규칙이나 테스트로 만들 수 있는지 먼저 보는 거예요. 새로 생기는 것부터 막고 이미 있는 건 그 다음에 지우고요. 그리고 에이전트가 자기 결과를 직접 실행해서 확인할 방법을 하나 열어 주는 거예요.

**22:29** · 스크린샷이든 테스트 출력이든 사람이 코드 대신 그 증거를 볼 수 있게요.

**22:33** · 주석을 거의 다 없애는 일이나 PR 자동 병합은 다른 이야기예요. 로렌 탄도 PR 수천 개를 올리는 데까지 여섯 달이 걸렸다고 했고 팀의 숫자는 그 팀의 코드베이스에서 나온 거예요.

**22:41** · 그러니 피라미드의 맨 윗칸부터 한 가지씩 옮겨 보면 돼요. 발표에 나온 피스택 저장소 주소는 설명란에 둘게요. 구독과 좋아요는 영상을 만드는 데 큰 힘이 됩니다. 오늘은 여기까지입니다.