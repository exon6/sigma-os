---
title: "Claude 2.0, 터미널만 쓰던 제가 데스크톱 앱을 켠 이유"
source: "https://www.youtube.com/watch?v=D62GKEzlD48"
author:
  - "[[StefanCho With AI (스테판초)]]"
published: 2026-10-29
created: 2026-11-16
description: "📝 단축키와 넣은 프롬프트 정리(블로그): https://blog.stefancho.dev/youtube/claude-desktop-nested-session-btw-mods?utm_source=youtube&utm_medium=description&utm_campaign=2026-10-28-claude-desktop-2Claude 데스크톱 앱이 10"
tags:
  - "clippings"
---
![](https://www.youtube.com/watch?v=D62GKEzlD48)

📝 단축키와 넣은 프롬프트 정리(블로그): https://blog.stefancho.dev/youtube/claude-desktop-nested-session-btw-mods?utm\_source=youtube&utm\_medium=description&utm\_campaign=2026-10-28-claude-desktop-2  
  
Claude 데스크톱 앱이 10월에 크게 바뀌어서 직접 써 봤습니다. 「Claude 2.0」은 공식 이름이 아니라, 이 업데이트를 해외 유튜버들이 부르는 별명입니다. 평소 터미널과 herdr 로 여러 세션을 나눠 쓰다 보니 정신이 없어서, 메인 세션만 보이게 하는 데스크톱 앱을 직접 만들고 있었는데요. Claude 데스크톱에 Nested Session(세션 아래 세션)이 들어오면서 제가 만들려던 것과 거의 같은 방향이 됐습니다.  
  
영상에서는 제 블로그 작업으로 스타일 세션과 콘텐츠 세션을 Nested Session 으로 나누고, 상위 세션에서 일을 보내는 것부터 Alt(Option) + 클릭 탭 나누기, 컨텍스트 정보 표시, /btw 사이드 채팅, 여러 세션 한 번에 고르기, Mods 로 입력창 위 캐시 표시 만들기, 대화를 챕터로 고정하기까지 실제로 해 봅니다. 터미널을 좋아하지만, GUI 가 필요할 때는 Claude 데스크톱을 쓰는 게 낫겠다는 후기로 마무리합니다.  
  
🔗 영상에 나온 링크  
Claude 데스크톱 앱: https://claude.ai/download  
herdr — AI 에이전트용 터미널 멀티플렉서: https://github.com/ogulcancelik/herdr  
Impeccable — Claude Code 디자인 스킬: https://github.com/pbakaus/impeccable  
지난 영상, Impeccable Live: https://youtu.be/yep-NVI-Mfs  
  
🤖 캔버스 위 손그림 모션그래픽은 Claude Code 로 코드(Remotion)를 짜서 만들었습니다.  
  
📖 하네스 엔지니어링을 다룬 제 책 「요즘 바이브 코딩 하네스 with 클로드 코드」 (골든래빗)  
예스24: https://www.yes24.com/product/goods/190806231  
교보문고: https://product.kyobobook.co.kr/detail/S000220119542  
  
⏱ 챕터  
00:00:00 미리보기  
00:00:17 Intro  
00:01:52 Nested Session 만들기  
00:02:57 상위 세션에서 일 보내기  
00:03:39 브라우저 패널과 Impeccable Live  
00:04:34 탭 나누기 (Alt / Option + 클릭)  
00:05:25 컨텍스트 정보 표시  
00:05:49 사이드 채팅 /btw  
00:07:11 마스터 세션 하나로 일하기  
00:07:57 여러 세션 한 번에 고르기  
00:08:30 Mods로 캐시 표시 만들기  
00:09:49 데스크톱이 편해진 이유  
00:11:12 대화를 챕터로 고정  
00:11:42 후기  
  
디스코드 참여하기 : https://discord.gg/fPqpD5wvza  
  
#ClaudeCode #클로드코드 #Claude #클로드데스크톱 #바이브코딩

## Transcript

### 미리보기

**0:00** · It has appeared, and if you look to the left, you can see the sessions listed at the bottom. It feels a bit anticlimactic, but since the direction seems almost exactly the same as what I was trying to create, I strongly felt that it would be better to just use the Clod Desktop app when a GUI is needed.

**0:16** · Yes. Hello. Today, I plan to test out Clod Desktop. I usually only like the Terminal, so the reason I am suddenly talking about Clod Desktop is that it has changed quite a bit. So, I was curious and wanted to test it out.

### Intro

**0:32** · There are several features, but I will just talk about a few of the key ones.

**0:36** · First, regarding "Stacked Sessions," originally, Clod Code Sessions didn't have a feature to split sessions on the desktop other than dividing them into sub-agents. But now, you can manage nested sessions. When I use something like Herder, I can split windows and do things like that using Herder agent skills. I can also push all my work, so I used to utilize those features, but it was a bit more chaotic than I expected.

**1:06** · Things were getting too fragmented, so to manage them less chaotically, I originally planned to create a "reader mode" in the desktop app to hide the main session—or should I call them sub-sessions?—when in Phase 1 mode. I intended to resolve this by hiding the worker sessions when viewing the chat window, but I have practically put that project on hold for the desktop.

**1:34** · The reason is that while it was fun to build, I was spending too much time modifying it, so I put it aside. However, when I looked at the Claude desktop map, that feature was already included. So I thought, " That looks pretty good," and decided to test it out. Okay, let's look at this first. It has changed quite a bit more than I expected, but here, you just need to request that a Netted Session be created.

### Nested Session 만들기

**1:59** · Since I can easily show you the page from my personal blog in the video, I think we can discuss that using that. Let's say I'm working on my blog and want to create a Netted Session. First, I intend to modify only the styles in the first session, and edit the content in the second. However , since I want to manage both separately, please create a "Next Session." So, let's wait. What appeared now?

**2:32** · It has appeared, and if you look to the left, you can see the sessions listed at the bottom. This isn't just a simple grouping; these are actually nested sessions. If you right-click here and look at the contents, you'll see "Hide Nested Sessions." So, this is a genuine nesting, intentional. And if you click on it and go inside, you'll see that the session isn't a server agent; it's set up exactly like our regular main session. Now, how do you use this?

### 상위 세션에서 일 보내기

**2:58** · Well, you don't necessarily need to send a chat message from here; if you speak to the top-level session, it will send the task over here. Yes.

**3:09** · So, you can manage it like this, and let's give it a try. For the style modification, I'll ask them to add a hover-click animation. Then the task will be placed here. If you go inside, yes, it has received the task. Since you asked me to change the style right now, I’ve been thinking that when I’m managing things in a hectic state , maybe I should just close the terminal and work by opening a nested session on the Claude desktop. It’s been so chaotic lately while working.

**3:37** · So, you can have it work like this. I don't think I need to test it any further here. Okay, if you click this, it opens like this. The reason it says there is nothing here right now is because this is local and there is no database. Anyway, what makes it convenient is that you can click here, and like this, select that element—or whatever you call it—and then discuss it. That is possible. Also, I mentioned the Impactable Live Edit in the video right before this. So, you can use that here as well.

### 브라우저 패널과 Impeccable Live

**4:09** · If you type "Impactable Live," you can use not only the element selection and pen functions used in Claude Code, but also the Live Edit.

**4:20** · This allows you to make modification requests more powerfully. I think that is a good feature. If you look here, the Live Edit feature has been added.

**4:29** · You can edit right away. Now, please refer to the video right before this one for how to use this. Next, let's move on to the second feature: splitting tabs. Press Alt or Option (I think it's Option on a Mac, or Alt on Windows) and click to view in Split View. This is the Main Session right now. We call it the Master Session, and the one below it is the Worker Session —I'll call it the Worker. If you press Alt and click the Worker like this, it separates here.

### 탭 나누기 (Alt / Option + 클릭)

**4:57** · If you press Alt again and click like this, it separates again. So, here, you can adjust the text size. If you reduce the text size using Command + Minus, you can view it larger, and I found that you can also change the layout. In the View Options, if you select "Down" for Split Screen, it moves like this. So, things like this are possible, but it seems you can't drag and drop to move it. Anyway, it seems that splitting the screen to your desired extent is now possible. Okay, and now regarding the " Display Context Information" feature, I'm not sure if it was originally there .

### 컨텍스트 정보 표시

**5:28** · But if you look here, there is this button. If you press it at the top, below the Session Rails display button, this appears. Pressing this shows how much context is being used. You can check all of this, see what sub-addents are in use, what memory is being used, connected connectors, and the entire environment. Now, you can turn the remote control on and off here, and yes , you can also add environment variables. And now, side chat. Side chat was originally called "By the Way, " which is an abbreviation for "By the Way."

### 사이드 채팅 /btw

**6:00** · It is true that you could use "By the Way" before, but it used to appear somewhat like a popup. It used to appear as a popup, but now it appears as a screen attached directly to the side. If you do this, I'll try turning off something else. If you do this, the side chat appears like this. So, you can add side chats. You can continue asking questions through multiple side chats. For example, in the first side chat, you could say, "Summarize the tasks you have requested so far." You can speak concisely like this, and if you click, you move to this session.

**6:28** · And you can chat again in the second side chat, of course. So, you can create and manage multiple side chats in this way. I think this would be good for long work sessions. Because when I work for a long time—usually for an hour or two—I often want to ask questions in the middle of it. Whether it's about progress or what work has been done so far, it is much more convenient to have multiple side chats open to ask. Also, since the Steed sessions are being managed, it seems you can ask questions about the work in the sessions below them.

**6:58** · If you say, " Please summarize the work done in the Steed session," it will summarize it for you. So, you can ask questions about all the sessions managed below.

**7:08** · So, I think this is pretty good. The scenario that comes to mind right now is to have a main session—or rather, a master session—and below it, worker sessions—which you could also call Steed sessions. You can have multiple workers running under the master session while keeping the work running in the master session, and ask questions about anything you're curious about here in the Buy the Way side chat .

### 마스터 세션 하나로 일하기

**7:37** · By doing this, you can continue working using just this one master session. Also, if you want to pin the master session, you can right-click and select "Pin," and you can see that it is now pinned. If you unpin it, it will come down again. So, I think this is actually pretty good. Also, a tip popped up here; it seems you can select multiple items by holding down Shift and clicking.

### 여러 세션 한 번에 고르기

**8:01** · So, if you hold down Shift and click like this, all three are selected, and if you right-click, you can swap all three models or do something with them all at once. It’s not that this wasn't possible in the previous version of Huder, but everything works now. You can consider everything that works in the terminal and everything that works on the desktop to work in the terminal as well . Anyway, everything works, but since the GUI screen requires less visual attention, I think that is a good thing . Okay, and now regarding "Modes," this actually existed before, but I haven't actually used them in the desktop app.

### Mods로 캐시 표시 만들기

**8:35** · So, if you plan to use the desktop app occasionally, it would be good to have Modes enabled. I just made a simple one . I think you can create something called a "Meter" to check it. You just need to use the plugin skill and tell them what you want. "Please create a Mode above the input field—above the desktop app input field—so that we can see things like the current cache status and session information.

**9:06** · Also, regarding the design style, I'd like it to be a bit stylish rather than too generic. I'll say something like this to fit well with the desktop app's design system and press Enter." Then, it asks another question. It asks whether to start in a separate session or in a set session. I've seen this for the first time, but hmm, it seems good.

**9:31** · I'll click "Set Session." Okay, doing this, ah, yes, it opens the set session from the separate session. Should I call the task itself the master session ? It seems they are going with a method where it opens up a sub-page instead of doing it here. Basically. So, if you click this, you can just pop right in.

**9:46** · You can go right into the work you're currently doing and see it. Now, regarding the Cloud desktop app, what I consider an advantage compared to the terminal—or rather, what I originally thought was a disadvantage but now see as an advantage—is that in the terminal, should I call it the output response? Output tokens just pour out.

### 데스크톱이 편해진 이유

**10:07** · The work you are doing just pours out like crazy. In the past, since you could get a sense of the situation in between, the text you roughly saw was sufficient. However, lately, I am experiencing severe overload when working. So, I am feeling the limits of the size of my mental context window.

**10:30** · It is a situation where information is constantly being pushed out, telling me that it needs to stop coming in.

**10:34** · Because of that, I actually find it more comfortable to just not show it.

**10:37** · Since I'm not going to intervene and make it do all sorts of things anyway, I think it's more convenient to just let it proceed on its own without showing the progress at all. It feels much easier for me if it just sends me a message once it's finished. So, in that respect, Clutter Desktop seems a bit better. Anyway, I've done this, and it asked if I wanted to turn it on in the session, so I said yes. It looks like the work is done, so I'll turn it on. Look, it's set up like this. It's not exactly stylish. It's just made at a decent level, and it's not bad.

**11:09** · So, I've explained Clutter 2.0 today.

### 대화를 챕터로 고정

**11:16** · Lastly, if you look here, you know the conversation we had here? If you click on it, there's an option to pin it to a chapter. If you click that, you can move it like this at the top left. So, if I want to bookmark a specific conversation in the middle, I think it would be convenient to click these things to navigate to it. Yes. Anyway, today I talked about Claude 2.0, or Claude Desk.

**11:40** · To give you my final review, I used to be someone who really loved the terminal, and of course, I still do. I really enjoy using CLI tools in the terminal, but when I'm working, it gets really chaotic. By " chaotic," I mean that the terminal window I've opened up just doesn't get organized. So, when that happens, I really just want to shut everything down.

### 후기

**12:09** · To solve that, I actually created a desktop app myself called "Live Gosti ," putting the terminal into that app and customizing it. But because of that , it became difficult to manage, and I kept getting the urge to pursue more features. I ended up spending so much time on it that I just gave up. It hasn't even been a day since I gave up.

**12:30** · Actually, I decided this morning that I just needed to throw this away, so yes.

**12:35** · However, after seeing how the cloud desktop app has become customizable and supports nested sessions, I strongly felt that it is better to just use a cloud desktop app when a GUI is needed.

**12:52** · It feels a bit anticlimactic, but since the direction is almost exactly the same as what I was trying to create, I hope you give it a try. Thank you.