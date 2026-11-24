---
title: "맷 포콕이 공개한, AI 하나로 모든 프로젝트를 관리하는 방법"
source: "https://www.youtube.com/watch?v=EV8NmofeWPk&t=6s"
author:
  - "[[민둥이 | 쉽게 배우는 AI]]"
published: 2026-11-14
created: 2026-11-16
description: "맷 포콕(Matt Pocock)이 직접 공개한 '홈 레포(Home Repo)' 방식을 정리했습니다. 스킬·규칙·위키를 레포 하나에 모아 두고, AI 하나가 그 레포에서 여러 프로젝트를 오가며 일하게 만드는 방법입니다! [원문·자료]맷 포콕 원본 영상: https://www.youtube.com/watch?v=hWe-j78vNpc홈 레포 글(셋업 프롬"
tags:
  - "clippings"
---
![](https://www.youtube.com/watch?v=EV8NmofeWPk)

맷 포콕(Matt Pocock)이 직접 공개한 '홈 레포(Home Repo)' 방식을 정리했습니다. 스킬·규칙·위키를 레포 하나에 모아 두고, AI 하나가 그 레포에서 여러 프로젝트를 오가며 일하게 만드는 방법입니다!  
  
\[원문·자료\]  
맷 포콕 원본 영상: https://www.youtube.com/watch?v=hWe-j78vNpc  
홈 레포 글(셋업 프롬프트): https://www.aihero.dev/the-home-repo-pattern  
X 원글: https://x.com/mattpocockuk/status/2120260969750540327  
카파시 LLM 위키: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f  
맷 포콕 스킬 모음: https://github.com/mattpocock/skills  
  
\[타임라인\]  
00:00 맷 포콕의 홈 레포가 화제가 된 이유  
00:42 홈 레포 구조: 본사와 계열사  
02:17 각 레포의 작업 방식까지 따르게 하는 법  
03:17 개인 위키와 외부 도구 연결  
04:31 프롬프트 하나로 내 홈 레포 만들기  
  
\[셋업 프롬프트 사용법\]  
레포들이 모여 있는 폴더에서 클로드코드나 나 코덱스를 켜고 아래 프롬프트를 붙여 넣으시면 됩니다.  
  
Set up a Home Repo with me: one git repo that holds my shared skills, AGENTS.md and shared docs, and points at my other repos. I'll run my agent from it.  
  
\## How to work  
\- Look up every fact yourself (filesystem, git, gh), using subagents for wide searches. Bring me only decisions.  
\- Put decisions to me in rounds. Number each question, give your recommended answer, and word it so "yes" accepts it. A question that depends on one still open waits for a later round.  
\- Until I approve the plan in Step 3, only read.  
\- Secrets stay where they are: leave .env and other secret files unread.  
  
\## Step 1: Inventory the repos  
Find every git repo under my home directory, skipping dependency folders. For each, record its path, remote, visibility (public or private) and last commit date.  
In the first round, ask:  
\- which repos the Home Repo points at (recommend those with recent commits)  
\- where it lives, and whether it's new or an existing repo (recommend a new private repo beside the others)  
\- whether it's personal or shared with a team  
\- which file my harness loads at session start: AGENTS.md, CLAUDE.md or both (recommend what my setup shows)  
Done when every repo found is marked in or out, and the other three questions are answered.  
  
\## Step 2: Inventory the shared material  
Across the chosen repos and my user-level skill folders (such as ~/.claude/skills), list every skill (a folder with a SKILL.md), every AGENTS.md and CLAUDE.md, and every doc written for agents: coding standards, glossaries, ADRs.  
Sort each item into one bucket:  
\- shared: true across repos  
\- duplicate: the same item in several places; diff the copies and mark the newest  
\- repo-specific: about one repo's code, commands or domain  
\- installed: from a published skills repo or marketplace  
Done when every item sits in exactly one bucket.  
  
\## Step 3: Agree the plan  
Show a table of every item, where it is now, and its destination:  
\- shared and duplicate: move to the Home Repo, one copy, newest version  
\- repo-specific: stays in its repo  
\- installed: stays installed  
Under it, show the Home Repo's AGENTS.md: a short intro, then an "Other Repos" section with one pointer per repo:  
\[name\] (\[what it is\]): \[local path\]. Clone from \[remote\] if missing.  
Add a hint where a repo needs one, such as "read its AGENTS.md first". Past about 20 repos, group the pointers into one file per area and point at those files instead.  
Settle open items in further rounds. Done when I approve the table and the AGENTS.md.  
  
\## Step 4: Apply the plan  
1\. Create the Home Repo and its AGENTS.md. If my harness loads a different file, add that file as a one-line pointer to AGENTS.md.  
2\. Copy each shared item in, keeping skill folders whole.  
3\. In each child repo, on a new local branch, remove the copies that moved. Repo-specific material stays.  
4\. Commit in the Home Repo. Pushing is my call.  
Done when every row of the table is applied. Report each row's outcome, the branches you created in each repo, and anything you skipped, with the reason.  
  
#클로드코드 #ClaudeCode #AI코딩

## Transcript

### 맷 포콕의 홈 레포가 화제가 된 이유

**0:00** · 제가 자주 소개해 드린 맵포콕, 타입스크립트 강의로 유명하고 그림이 스크립트가 포함된 깃허브 스타 32만개짜리 스킬 모음을 만든 개발자인데요. 최근 그가 AI에게 여러 레포를 한 번에 맡기는 방법을 공개하면서 \[음악\] 큰 화제가 됐습니다. 레포는 프로젝트의 코드가 담긴 저장소를 말합니다. 프로젝트가 많아질수록 코딩

**0:18** · 규칙이나 자주 쓰는 스킬이 여기저기 흩어지고 여러 프로젝트를 함께 수정하기도 번거로워집니다. \[음악\] 맷은 이런 문제를 홈 레포라는 방식으로 해결했습니다. 여러 프로젝트에 흩어진 규칙과 스킬을 한 곳에 모아두고 AI가 이를 중심으로 여러 레포를 오가며 \[음악\] 작업하도록 만드는 겁니다.

**0:36** · 오늘은 맷이 홈 레포를 어떻게 구성하고 실제 작업에 활용하는지 살펴보겠습니다.

### 홈 레포 구조: 본사와 계열사

**0:42** · 쇼핑몰로 예를 들어보겠습니다. 화면만 고칠 땐 그 레포에서 AI를 켜면 되지만 결제 서버까지 함께 수정해야 한다면 어떨까요?

**0:49** · AI가 여러 레포를 오가며 작업해야 하고 \[음악\] 프로젝트마다 따로 관리하는 규칙과 스킬도 신경 써야 합니다.

**0:55** · 맷이 제안한 방식은 삼성 같은 대기업 그룹을 떠올리면 이해하기 쉽습니다.

**1:00** · 삼성전자, 삼성 SDI \[음악\] 같은 계열사는 저마다 일을 하지만 그룹 전체가 따르는 규칙은 본사가 한 번 정해 내려보내죠.

**1:07** · 홈 레포가 바로 그 본사입니다. 맷은 스킬 관리와 규칙, 위키 도구를 전부 홈 레포에 두고 쇼핑몰이나 결제 서버 같은 레포는 계열사처럼 각자 코드만 맡게 했습니다. AI는 본사 직원처럼 공통 규칙과 스킬을 가지고 각 계열사를 오가며 일하는 거죠.

**1:24** · 맷은 홈 레포의 스킬 폴더에 사업상 중요해서 외부에 공개하지 않는 스킬도 넣어뒀습니다.

**1:30** · 이렇게 한 곳에 모아두면 어느 프로젝트에서 작업하든 같은 스킬을 활용할 수 있는 거죠.

**1:35** · AI 설정 파일도 홈 레포에서 버전 관리하면서 변경 사항을 팀 전체에 공유할 수 있도록 설계했습니다. 그럼 AI는 여러 레포 중에서 어디로 가야 할지 어떻게 할까요?

**1:46** · 맷은 이를 위해 클라우드 MD라는 지침 파일을 활용했습니다. AI가 작업할 때 참고하는 파일인데 여기에 각 레포의 위치와 역할을 정리해 둔 겁니다.

**1:56** · 예를 들어 스킬을 수정해야 하면 스킬 레포로, 강의 영상을 하면 해당 레포로 찾아가는 식입니다. 컴퓨터에 없는 레포는 필요할 때 내려받고 AI 여러개가 같은 레포에서 작업할 땐 자, 작업용 사본을 따로 만들어 충돌하지 않도록 했습니다. 이렇게 홈 레포를 중심으로 AI가 필요한 프로젝트를 찾아가며 작업할 수 있게 만든 거죠.

### 각 레포의 작업 방식까지 따르게 하는 법

**2:17** · 다만 레포를 찾아가더라도 \[음악\] 그곳에서 어떻게 작업해야 하는지는 또 다른 문제입니다.

**2:22** · 레포마다 코드를 빌드하거나 테스트하는 방법이 다를 수 있기 때문인데요.

**2:26** · 보통 이런 내용은 각 레포의 \[음악\] 지침 파일에 적혀 있습니다. 클라우드 코드라면 클라우드 MD, 코덱스라면 에이전트 MD 같은 파일이죠.

**2:35** · 그런데 클라우드 코드는 다른 폴더를 연결해도 그 폴더의 지침 파일까지 항상 자동으로 읽는 건 아닙니다.

**2:42** · 그래서 맷은 홈 \[음악\] 레포에, 클라우드 MD에 각 레포의 위치뿐 아니라 작업하기 전에 해당 레포의 지침 파일부터 읽으라는 내용도 함께 적어뒀습니다.

**2:52** · AI가 프로젝트를 찾아가는 데서 끝나는 게 아니라 그 프로젝트의 작업 방식까지 확인하도록 한 겁니다.

**2:58** · 레포가 많아지면 이 지침 파일을 관리하는 방식도 달라지는데요.

**3:02** · \[음악\] 맷은 20개에서 40개 정도라면 하나의 파일로 충분하지만 400개쯤 된다면 프론트엔드, 백엔드, 내부 도구처럼 분야별로 나눠 관리하라고 했습니다. AI가 먼저 분야를 찾고 그 안에서 필요한 레포를 찾아가는 방식이죠.

### 개인 위키와 외부 도구 연결

**3:17** · 여러 레포를 한 곳에서 관리할 수 있게 되자 맷은 홈 레포를 개발뿐 아니라 \[음악\] 자신의 사업과 콘텐츠 제작에도 활용하기 시작했습니다.

**3:25** · 대표적인 게 개인 위키인데요. 오픈 AI 창립 멤버 안드레이 카파시가 제안한 방식으로 자료를 넣으면 AI가 내용을 요약하고 관련된 정보들을 서로 연결해 위키를 만들어줍니다.

**3:37** · 질문할 때마다 자료를 처음부터 다시 찾을 필요 없이 그동안 정리해 둔 지식을 활용할 수 있는 거죠.

**3:43** · 맷도 여기에 자신의 사업 관련 자료를 쌓아두고 강의나 콘텐츠를 만들 때 활용한다고 합니다.

**3:48** · 필요한 정보를 위키에 쌓아두는 것뿐 아니라 외부 서비스에서 직접 정보를 가져오거나 작업할 수 있도록 도구도 연결했습니다.

**3:57** · 지메일, 슬랙, 디스코드, 유튜브, 깃허브, \[음악\] 구글 캘린더 등이 있는데요.

**4:02** · 홈 레포에서 위키헬프를 입력하면 사용할 수 있는 도구들을 확인할 수 있고, SNS 예약 HTML 보고서 만들기 같은 스킬을 이용해 강의 영상까지 수정하는 식입니다.

**4:23** · 원래라면 여러 서비스와 레포를 직접 오가며 처리해야 할 일을 홈 레포에서는 AI 하나가 다 돌고 옵니다.

### 프롬프트 하나로 내 홈 레포 만들기

**4:31** · 이 홈 레포는 매시 공개한 프롬프트 하나로 직접 만들어 볼 수 있습니다.

**4:35** · AI에게 이 프롬프트를 입력하면 기존 프로젝트와 스킬을 살펴보고 필요한 내용을 하나씩 물어보는데요. AI와 함께 차근차근 설계하면서 나만의 홈 레포를 만들어 보시면 됩니다. 매시 공개한 원문과 프롬프트는 영상 설명란과 고정 댓글에 남겨두겠습니다.

**4:49** · 영상이 도움이 되셨다면 구독과 좋아요 부탁드립니다.