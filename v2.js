/* SIGMA OS V2 MODULES:
   1. 6-Stock Earnings Call & CapEx Time-Series Interactive SVG Chart
   2. Obsidian Note Connection Graph View (HTML5 Canvas: 1-Hop, 2-Hop, Global)
   3. Split Pane Side-by-Side Reader & Thought/Thesis Editor
   4. Daily Note Habit & Review Calendar Heatmap (1. Daily Note/)
*/
(function () {
  "use strict";

  const EARNINGS_SERIES = {
    NVDA: {
      title: "NVIDIA (NVDA) // Q1 FY25 – Q3 FY27 (11 QUARTERS + Q4E)",
      unit: "$B",
      sourcePath: "9. Wiki/Sources/src-nvda-earnings-calls-fy25-fy27.md",
      quarters: ["Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26", "Q4 26", "Q1 27", "Q2 27", "Q3 27", "Q4 27E"],
      series: [
        { name: "TOTAL REVENUE ($B)", color: "#f0b8ff", type: "line", values: [26.0, 30.0, 35.1, 39.3, 44.1, 46.7, 57.0, 68.0, 82.0, 96.2, 115.8, 130.0] },
        { name: "DATA CENTER ($B)", color: "#6b9cff", type: "bar", values: [22.6, 26.3, 30.8, 35.6, 39.1, 41.2, 51.0, 62.0, 75.0, 89.0, 107.6, 121.0] },
        { name: "NETWORKING ($B)", color: "#2dd4bf", type: "line", values: [3.2, 3.7, 4.1, 5.0, 6.0, 7.3, 8.2, 11.0, 15.0, 17.7, 21.0, 24.0] },
      ],
      gpm: ["78.9%", "75.7%", "75.0%", "73.5%", "71.3% (ex-H20)", "72.7%", "75.0%", "75.0%", "75.0%", "75.0%", "74.9%", "71.5% (Q4E 바닥)"],
      notes: [
        "Hopper H100 수요 폭발 · 가이던스 $24B 대비 $26.0B 달성",
        "Blackwell 마스크 재설계 후 Q4 수십억 달러 약속 · $30.0B 달성",
        "H200 램프 · SW/서비스 연환산 $1.5B · $35.1B 달성",
        "Blackwell 첫 분기 $11.0B으로 약속 초과 달성 · FY25 매출 $130.5B",
        "미국 H20 수출통제 상각 $4.5B에도 매출 $44.1B으로 가이던스 상회",
        "H20 -$4B 급감에도 Blackwell ~$27B·네트워킹 $7.3B로 $46.7B 달성",
        "GB300 본격 램프 · 매출 $57.0B (가이던스 $54B 상회)",
        "연간 DC $194B · 소버린 AI $30B+(약속 $20B+ 초과 달성)",
        "14분기 연속 QoQ 성장 · 구매약정 $145B · 매출 $82.0B",
        "매출 $96.2B(+106%) · FY28 성장률 가이던스 +70% 최초 제시",
        "매출 $115.8B(+103%) · Vera Rubin 첫 분기 ~$20B · 보증 $118B · Jensen 사임(11/12)",
        "가이던스 $130.0B ±3% · FY28 성장률 ~+75% 상향 · HBM 비용으로 GPM 71~72% 바닥 전망",
      ],
    },
    AVGO: {
      title: "BROADCOM (AVGO) // Q1 FY24 – Q3 FY26 (11 QUARTERS + FY27E/28E)",
      unit: "$B",
      sourcePath: "9. Wiki/Sources/src-avgo-earnings-calls-fy24-fy26.md",
      quarters: ["Q1 24", "Q2 24", "Q3 24", "Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26"],
      series: [
        { name: "CONSOLIDATED REV ($B)", color: "#f0b8ff", type: "line", values: [12.0, 12.5, 13.1, 14.1, 14.9, 15.0, 16.0, 18.0, 19.3, 22.2, 29.6] },
        { name: "SEMICONDUCTOR ($B)", color: "#6b9cff", type: "bar", values: [7.4, 7.2, 7.3, 8.2, 8.2, 8.4, 9.2, 11.1, 12.5, 15.0, 20.8] },
        { name: "AI SEMICONDUCTOR ($B)", color: "#f97316", type: "line", values: [2.3, 3.1, 3.2, 3.7, 4.1, 4.4, 5.2, 6.5, 8.4, 10.8, 16.7] },
      ],
      gpm: ["75.4%", "76.2%", "77.4%", "76.9%", "79.1%", "78.8%", "77.5%", "77.0%", "76.5%", "75.8%", "74.5% (Q4E 73%)"],
      notes: [
        "VMware 10.5주 반영 · AI 반도체 $2.3B (4x YoY)",
        "VMware 온기 반영($2.7B) · AI 반도체 $3.1B (+280% YoY)",
        "네트워킹 $4.0B · Q4 AI $3.5B+ 가이던스",
        "FY24 연간 AI $12.2B · FY27 AI SAM $60B~$90B 최초 제시",
        "AI 반도체 $4.1B (가이던스 $3.8B 상회) · GPM 79.1%",
        "AI 반도체 $4.4B · AI 네트워킹 비중 40% (+70% YoY)",
        "AI 반도체 $5.2B (XPU 비중 65%) · 전사 백로그 $110B 사상 최고",
        "AI 반도체 $6.5B · AI 백로그 $73B+ (Tomahawk 6 스위치 $10B+)",
        "AI 반도체 $8.4B (+106%) · Meta MTIA 로드맵 건재 재확인",
        "AI 반도체 $10.8B (+143%) · AI 수주 $30B+ · OPM 67% 사상 최고",
        "AI 반도체 $16.7B (+221%) · FY26E $58B → FY27E $115B → FY28E $230B · Anthropic/OpenAI XPV $35B",
      ],
    },
    MRVL: {
      title: "MARVELL (MRVL) // Q1 FY25 – Q2 FY27 (10 QUARTERS + Q3E & INVESTOR DAY)",
      unit: "$B",
      sourcePath: "9. Wiki/Sources/src-mrvl-earnings-calls-fy25-fy27.md",
      quarters: ["Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26", "Q4 26", "Q1 27", "Q2 27", "Q3 27E"],
      series: [
        { name: "TOTAL REVENUE ($B)", color: "#f0b8ff", type: "line", values: [1.16, 1.27, 1.52, 1.82, 1.90, 2.01, 2.08, 2.22, 2.42, 2.74, 3.15] },
        { name: "DATA CENTER ($B)", color: "#2dd4bf", type: "bar", values: [0.82, 0.88, 1.10, 1.37, 1.44, 1.49, 1.52, 1.65, 1.84, 2.17, 2.58] },
      ],
      gpm: ["62.4%", "61.9%", "60.5%", "60.1%", "59.8%", "59.5%", "59.7%", "59.0%", "58.9%", "58.9%", "58.0% (Q3E)"],
      notes: [
        "데이터센터 $816M (+87% YoY, 비중 70%) · 광 DSP 호조",
        "데이터센터 $881M (+92% YoY) · 커스텀 AI 실리콘 양산 예고",
        "매출 $1.52B (가이던스 $66M 상회) · FY25 AI 목표($1.5B) 조기 돌파",
        "데이터센터 $1.37B (비중 75%) · FY25 연간 매출 $5.77B",
        "데이터센터 $1.44B (+76% YoY, 비중 76%)",
        "6월 커스텀 실리콘 이벤트: 2028 DC TAM $94B · 다세대 소켓 18개",
        "자동차 이더넷 매각 · 광 인터커넥트 기회 $10B+ 강조",
        "FY26 연간 매출 $8.195B (+42%) · 연간 데이터센터 $6B+ (+46%)",
        "매출 $2.42B (+28%) · Non-GAAP OPM 35.0%",
        "매출 $2.74B (+37%, DC 비중 79%) · 6년 최대 $120B 워런트 · 공급 선급금 $1B",
        "Q3 가이던스 $3.15B (+50%+) · Investor Day FY28E $20B(DC $18B)·2030 TAM $400B · 11/2 Lumentum 합병",
      ],
    },
    GOOGL: {
      title: "ALPHABET (GOOGL) // Q1 2024 – Q3 2026 (CLOUD · CAPEX · FCF INVERSION)",
      unit: "$B",
      sourcePath: "9. Wiki/Sources/src-googl-earnings-calls-2024-2026.md",
      quarters: ["Q1 24", "Q2 24", "Q3 24", "Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26"],
      series: [
        { name: "GOOGLE CLOUD REV ($B)", color: "#6b9cff", type: "bar", values: [9.6, 10.3, 11.4, 12.0, 12.3, 13.6, 15.2, 17.9, 20.0, 24.8, 30.7] },
        { name: "QUARTERLY CAPEX ($B)", color: "#f97316", type: "line", values: [12.0, 13.2, 13.1, 14.3, 17.2, 22.4, 24.0, 27.9, 35.0, 45.5, 51.4] },
        { name: "FREE CASH FLOW ($B)", color: "#2dd4bf", type: "line", values: [16.8, 13.5, 17.6, 24.8, 19.0, 5.3, 24.5, 24.6, 14.0, 3.8, -9.1] },
      ],
      gpm: ["Cloud OPM 9.4%", "Cloud OPM 11.3%", "Cloud OPM 17.1%", "Cloud OPM 17.5%", "Cloud OPM 17.8%", "Cloud OPM 20.7%", "OPM 33.9%(전사)", "CapEx 연간 $91.4B", "Cloud OPM 32.9%", "2026 CapEx $195~205B", "Cloud OPM 36.2%"],
      notes: [
        "연결 매출 $80.5B · Cloud+YouTube 연말 런레이트 $100B+ 약속",
        "Google Cloud 분기 매출 $10B · 영업이익 $1B 사상 첫 돌파",
        "Cloud $11.4B (+35%, OPM 17.1%) · YouTube TTM $50B 돌파",
        "Cloud+YouTube 연말 런레이트 $110B으로 약속 초과 달성 · 2024 매출 $350B",
        "연결 매출 $90.2B · AI Overviews 검색 확장",
        "Cloud 백로그 $106B · 2025 CapEx 가이던스 $75B → $85B 상향",
        "사상 첫 분기 매출 $100B 돌파($102.3B)",
        "연결 매출 $113.8B · Q4 CapEx $27.9B (2025 연간 $91.4B)",
        "Cloud $20.0B (+63%, OPM 32.9%) · 백로그 $462B (QoQ 2배 급증)",
        "연결 매출 $119.8B · Cloud +82% · 백로그 $514B · 2026 CapEx $195B~$205B 상향",
        "연결 매출 $127.6B · Cloud $30.7B(+103%, OPM 36.2%) · 백로그 $561B · CapEx $51.4B · FCF -$9.1B 적자 · SpaceX 지분 평가손실",
      ],
    },
    SPCX: {
      title: "SPACEX (SPCX) // Q2 2026 – Q1 2027E (SUPER INTELLIGENCE · STARLINK · CAPEX)",
      unit: "$B",
      sourcePath: "9. Wiki/Sources/src-spcx-earnings-calls-2026.md",
      quarters: ["Q2 2026", "Q3 2026", "Q4 26E / Q1 27E"],
      series: [
        { name: "TOTAL REVENUE ($B)", color: "#f0b8ff", type: "line", values: [7.8, 14.6, 35.0] },
        { name: "SUPER INTELLIGENCE ($B)", color: "#c084fc", type: "bar", values: [2.6, 7.6, 22.0] },
        { name: "STARLINK CONNECTIVITY ($B)", color: "#6b9cff", type: "bar", values: [4.3, 5.2, 6.2] },
        { name: "QUARTERLY CAPEX ($B)", color: "#f97316", type: "line", values: [18.4, 19.6, 37.5] },
      ],
      gpm: ["EBITDA $3.5B (44.9%)", "EBITDA $8.8B (60.3%)", "2027말 13GW 목표"],
      notes: [
        "IPO 및 회사채 $25B 발행으로 현금 $100B 확보 · Starlink 1,200만 가입자 · 1.4GW 가동",
        "매출 $14.6B(+161%) · 순이익 +$4.4B 흑자 전환 · Super Intelligence $7.6B(비중 52.1%, Cursor $608M 포함) · 1.7GW 가동",
        "Q4 CapEx 가이던스 $35B~$40B · Q1 2027 매출 가이던스 $33B~$37B · 백로그 $63B(12개월 내 $42B 인식)",
      ],
    },
    COMPARE: {
      title: "6-STOCK AI RUN-RATE & OUTLOOK // 핵심 보유 6종목 연환산 AI 매출 · ARR 비교",
      unit: "$B",
      sourcePath: "9. Wiki/overview.md",
      quarters: ["NVDA (DC)", "GOOGL (Cloud)", "ANT (ARR)", "AVGO (AI)", "SPCX (SuperInt)", "MRVL (DC)"],
      series: [
        { name: "CURRENT ANNUALIZED RUN-RATE ($B)", color: "#6b9cff", type: "bar", values: [430.4, 122.8, 81.0, 66.8, 30.4, 8.7] },
        { name: "NEXT YEAR TARGET / GUIDANCE ($B)", color: "#f0b8ff", type: "line", values: [520.0, 180.0, 140.0, 115.0, 140.0, 18.0] },
      ],
      gpm: ["Q3 DC $107.6B×4", "Q3 Cloud $30.7B×4", "NVDA 콜 공식 언급 $81B", "Q3 AI $16.7B×4 → FY27E $115B", "Q3 SI $7.6B×4 → Q1 27E $35B/q", "Q2 DC $2.17B×4 → FY28E $18B"],
      notes: [
        "NVDA: Q3 FY27 데이터센터 연환산 $430.4B · Q4 전사 가이던스 $130B · FY28 +75% 성장 가이던스",
        "GOOGL: Q3 2026 Google Cloud 연환산 $122.8B (OPM 36.2%) · 백로그 $561B · 2026 CapEx $195~205B",
        "ANT: NVDA Q3 FY27 콜에서 ARR $81B 공식 확인 · Broadcom TPU 2027 5GW → 2028 10GW 로드맵",
        "AVGO: Q3 FY26 AI 반도체 연환산 $66.8B · FY27 전망 $115B · FY28 전망 $230B (XPV $35B 1차 트랜치)",
        "SPCX: Q3 2026 Super Intelligence 연환산 $30.4B (전사 매출의 52.1%) · Q1 2027 전사 가이던스 $33~37B",
        "MRVL: Q2 FY27 데이터센터 연환산 $8.7B (비중 79%) · Investor Day FY28E 전사 $20B (데이터센터 $18B)",
      ],
    },
  };

  const v2State = {
    chartTicker: "NVDA",
    chartSelectedIdx: 10, // default latest quarter
    graphDepth: 1, // 1 | 2 | 99 (global)
    splitActive: false,
    splitRightPath: "6. Resources/Thoughts/눈앞의 작은 이득보다 규칙을 지키는 쪽이 결국 이득이 된다.md",
    splitRightMode: "edit", // "edit" | "preview"
    calMonth: "2026-11",
    calSelectedDate: "2026-11-17",
  };

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ========================================================================
     1. 6-STOCK EARNINGS & CAPEX TIME-SERIES INTERACTIVE SVG CHART
     ======================================================================== */
  function renderEarningsChartPanel() {
    const cfg = EARNINGS_SERIES[v2State.chartTicker] || EARNINGS_SERIES.NVDA;
    const nQ = cfg.quarters.length;
    const selIdx = Math.min(Math.max(0, v2State.chartSelectedIdx), nQ - 1);

    // Compute min/max across all series
    let minVal = 0;
    let maxVal = 10;
    for (const s of cfg.series) {
      for (const v of s.values) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    const padTop = maxVal * 0.12;
    const yMax = Math.ceil(maxVal + padTop);
    const yMin = minVal < 0 ? Math.floor(minVal * 1.2) : 0;
    const yRange = Math.max(1, yMax - yMin);

    const W = 860;
    const H = 260;
    const leftPad = 54;
    const rightPad = 76;
    const topPad = 20;
    const botPad = 36;
    const plotW = W - leftPad - rightPad;
    const plotH = H - topPad - botPad;

    const xOf = (i) => leftPad + (nQ === 1 ? plotW / 2 : (i / (nQ - 1)) * plotW);
    const yOf = (v) => topPad + plotH - ((v - yMin) / yRange) * plotH;
    const yZero = yOf(0);

    // Grid lines (4 horizontal ticks)
    const gridSvg = [];
    for (let t = 0; t <= 4; t++) {
      const val = yMin + (yRange * t) / 4;
      const y = yOf(val);
      gridSvg.push(
        `<line x1="${leftPad}" y1="${y.toFixed(1)}" x2="${W - rightPad}" y2="${y.toFixed(1)}" stroke="var(--chart-grid)" stroke-width="1" />`,
        `<text x="${leftPad - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="var(--chart-axis)" font-family="var(--font-mono)" font-size="11">${val.toFixed(val < 10 && val !== 0 ? 1 : 0)}</text>`
      );
    }
    if (yMin < 0) {
      gridSvg.push(
        `<line x1="${leftPad}" y1="${yZero.toFixed(1)}" x2="${W - rightPad}" y2="${yZero.toFixed(1)}" stroke="var(--prev-close)" stroke-width="1.5" stroke-dasharray="4 4" />`
      );
    }

    // Selected quarter vertical guide line
    const selX = xOf(selIdx);
    gridSvg.push(
      `<line x1="${selX.toFixed(1)}" y1="${topPad}" x2="${selX.toFixed(1)}" y2="${topPad + plotH}" stroke="var(--frame)" stroke-width="1.5" stroke-dasharray="3 3" />`
    );

    // Bars & Lines
    const barSeries = cfg.series.filter((s) => s.type === "bar");
    const lineSeries = cfg.series.filter((s) => s.type !== "bar");
    const shapesSvg = [];

    const barGroupWidth = Math.min(36, (plotW / Math.max(1, nQ)) * 0.55);
    const singleBarW = barSeries.length ? barGroupWidth / barSeries.length : 16;

    barSeries.forEach((s, bIdx) => {
      s.values.forEach((v, i) => {
        const cx = xOf(i) - barGroupWidth / 2 + bIdx * singleBarW;
        const yTop = v >= 0 ? yOf(v) : yZero;
        const yBot = v >= 0 ? yZero : yOf(v);
        const bh = Math.max(2, yBot - yTop);
        const isSel = i === selIdx;
        shapesSvg.push(
          `<rect class="ob-chart-point" data-chart-idx="${i}" x="${cx.toFixed(1)}" y="${yTop.toFixed(1)}" width="${Math.max(4, singleBarW - 2).toFixed(1)}" height="${bh.toFixed(1)}" fill="${s.color}" opacity="${isSel ? "1" : "0.78"}" stroke="${isSel ? "var(--frame)" : "none"}" stroke-width="${isSel ? "2" : "0"}" />`
        );
      });
    });

    lineSeries.forEach((s) => {
      const pts = s.values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
      shapesSvg.push(`<polyline fill="none" stroke="${s.color}" stroke-width="3" points="${pts}" />`);
      s.values.forEach((v, i) => {
        const cx = xOf(i);
        const cy = yOf(v);
        const isSel = i === selIdx;
        shapesSvg.push(
          `<rect class="ob-chart-point" data-chart-idx="${i}" x="${(cx - (isSel ? 6 : 4)).toFixed(1)}" y="${(cy - (isSel ? 6 : 4)).toFixed(1)}" width="${isSel ? 12 : 8}" height="${isSel ? 12 : 8}" fill="${isSel ? "var(--ink)" : s.color}" stroke="var(--on-yellow)" stroke-width="2" />`
        );
      });
      // Right-axis ORDERBLOCK current value tag for primary line
      const lastVal = s.values[s.values.length - 1];
      const lastY = yOf(lastVal);
      shapesSvg.push(
        `<rect x="${W - rightPad + 6}" y="${(lastY - 10).toFixed(1)}" width="${rightPad - 10}" height="20" fill="${s.color}" />`,
        `<text x="${W - rightPad + 11}" y="${(lastY + 4).toFixed(1)}" fill="#011d1c" font-family="var(--font-mono)" font-size="11" font-weight="700">${lastVal}${cfg.unit}</text>`
      );
    });

    // X-axis labels
    const xLabelsSvg = cfg.quarters.map((q, i) => {
      const x = xOf(i);
      const isSel = i === selIdx;
      return `<text class="ob-chart-point" data-chart-idx="${i}" x="${x.toFixed(1)}" y="${H - 10}" text-anchor="middle" fill="${isSel ? "var(--accent-ink)" : "var(--chart-axis)"}" font-family="var(--font-mono)" font-size="11" font-weight="${isSel ? "700" : "400"}">${esc(q)}</text>`;
    });

    const legendHtml = cfg.series
      .map(
        (s) =>
          `<span class="ob-legend-item"><span class="ob-legend-swatch" style="background:${s.color};"></span><span>${esc(s.name)}</span></span>`
      )
      .join("");

    const selValuesHtml = cfg.series
      .map((s) => `<span>${esc(s.name.split(" (")[0])}: <strong style="color:${s.color};">${s.values[selIdx]}${cfg.unit}</strong></span>`)
      .join(" · ");

    return `
      <div class="ob-card" style="margin-bottom:24px;">
        <div class="ob-card__head">
          <span>TIME-SERIES TERMINAL // 6종목 어닝콜 매출 · 마진 · CapEx 시계열 차트</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${Object.keys(EARNINGS_SERIES)
              .map(
                (tkr) =>
                  `<button class="ob-chip ${v2State.chartTicker === tkr ? "is-active" : ""}" data-chart-ticker="${tkr}">${
                    tkr === "COMPARE" ? "6종목 AI 비교" : tkr
                  }</button>`
              )
              .join("")}
          </div>
        </div>
        <div class="ob-card__body">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
            <strong class="label" style="color:var(--accent-ink);">${esc(cfg.title)}</strong>
            <button class="ob-btn ob-btn--xs" data-note-path="${esc(cfg.sourcePath)}">OPEN WIKI SOURCE →</button>
          </div>
          <div class="ob-legend-row">${legendHtml}</div>
          <div class="ob-chart-stage">
            <svg class="ob-chart-svg" viewBox="0 0 ${W} ${H}" aria-label="${esc(cfg.title)}">
              ${gridSvg.join("")}
              ${shapesSvg.join("")}
              ${xLabelsSvg.join("")}
            </svg>
          </div>
          <div class="ob-chart-readout">
            <div>
              <span class="ob-badge ob-badge--yellow" style="margin-right:8px;">${esc(cfg.quarters[selIdx])}</span>
              ${selValuesHtml}
              ${cfg.gpm && cfg.gpm[selIdx] ? ` · <span class="ob-badge">MARGIN/METRIC: ${esc(cfg.gpm[selIdx])}</span>` : ""}
            </div>
            <div style="width:100%;margin-top:6px;color:var(--body);font-family:var(--font-sans);font-size:13px;">
              <strong>SAY-DO &amp; KEY FACT:</strong> ${esc((cfg.notes && cfg.notes[selIdx]) || "")}
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:10px;">
            ${cfg.quarters
              .map(
                (q, i) =>
                  `<button class="ob-btn ob-btn--xs ${i === selIdx ? "ob-btn--primary" : ""}" data-chart-idx="${i}">${esc(q)}</button>`
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  /* ========================================================================
     2. OBSIDIAN NOTE CONNECTION GRAPH VIEW (HTML5 CANVAS)
     ======================================================================== */
  function renderGraphPanel(centerNote) {
    if (!centerNote) return "";
    return `
      <div class="ob-graph-box">
        <div class="ob-graph-toolbar">
          <div>
            <strong>GRAPH VIEW // 노트 연결 네트워크</strong>
            <span style="color:var(--muted);margin-left:8px;">(노드 클릭: 해당 노트로 이동 · 드래그: 위치 이동)</span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="ob-chip ${v2State.graphDepth === 1 ? "is-active" : ""}" data-graph-depth="1">1-HOP (직접 연결)</button>
            <button class="ob-chip ${v2State.graphDepth === 2 ? "is-active" : ""}" data-graph-depth="2">2-HOP (확장 연결)</button>
            <button class="ob-chip ${v2State.graphDepth === 99 ? "is-active" : ""}" data-graph-depth="99">GLOBAL (핵심 허브 전체)</button>
          </div>
        </div>
        <canvas id="ob-note-graph-canvas" class="ob-graph-canvas" data-center-path="${esc(centerNote.path)}"></canvas>
        <div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px 12px;border-top:1px solid var(--hairline);font-family:var(--font-mono);font-size:11px;color:var(--muted);">
          <span><strong style="color:#fde9ff;">■</strong> 현재 노트</span>
          <span><strong style="color:#f97316;">■</strong> 6종목 투자 논리</span>
          <span><strong style="color:#c084fc;">■</strong> 생각·영구·참고 노트</span>
          <span><strong style="color:#6b9cff;">■</strong> 위키 엔티티·개념·종합</span>
          <span><strong style="color:#2dd4bf;">■</strong> 어닝콜·SEC·클리핑 출처</span>
        </div>
      </div>
    `;
  }

  function nodeColorFor(note, isCenter) {
    if (isCenter) return "#fde9ff";
    if (!note) return "#94a3b8";
    if (note.folder === "6. Resources/Stocks") return "#f97316";
    if (note.top_folder === "6. Resources") return "#c084fc";
    if (note.folder === "9. Wiki/Sources" || note.top_folder === "Clippings") return "#2dd4bf";
    if (note.top_folder === "9. Wiki") return "#6b9cff";
    return "#eab308";
  }

  function buildGraphData(appState, centerPath, depth) {
    const center = appState.byPath[centerPath];
    if (!center) return { nodes: [], edges: [] };

    const nodeMap = new Map();
    const edges = [];
    const addNode = (n, hop) => {
      if (!n || nodeMap.has(n.path)) return;
      nodeMap.set(n.path, {
        id: n.path,
        label: n.name.length > 24 ? n.name.slice(0, 22) + "…" : n.name,
        fullName: n.name,
        note: n,
        hop,
        color: nodeColorFor(n, n.path === centerPath),
      });
    };

    const resolve = (target) => {
      const clean = String(target || "").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].trim();
      if (!clean) return null;
      if (appState.byPath[clean]) return appState.byPath[clean];
      if (appState.byPath[`${clean}.md`]) return appState.byPath[`${clean}.md`];
      const stem = clean.split("/").pop().replace(/\.md$/i, "");
      return appState.byName[stem] || null;
    };

    if (depth === 99) {
      // Global hub view: Stocks + Thoughts + top Wiki Entities/Syntheses/Call Sources
      addNode(center, 0);
      const priority = appState.notes
        .filter(
          (n) =>
            n.folder === "6. Resources/Stocks" ||
            n.top_folder === "6. Resources" ||
            n.props.wiki_type === "synthesis" ||
            (n.folder === "9. Wiki/Entities" && (n.backlinks.length > 0 || n.links.length > 1)) ||
            (n.folder === "9. Wiki/Sources" && !n.name.startsWith("src-sec-"))
        )
        .slice(0, 44);
      priority.forEach((n) => addNode(n, 1));
    } else {
      addNode(center, 0);
      // 1-hop outgoing & incoming
      const hop1 = [];
      for (const l of center.links || []) {
        const t = resolve(l);
        if (t && t.path !== center.path) {
          addNode(t, 1);
          hop1.push(t);
          edges.push({ source: center.path, target: t.path });
        }
      }
      for (const bp of center.backlinks || []) {
        const bn = appState.byPath[bp];
        if (bn && bn.path !== center.path) {
          addNode(bn, 1);
          hop1.push(bn);
          edges.push({ source: bn.path, target: center.path });
        }
      }
      if (depth >= 2) {
        for (const h1 of hop1.slice(0, 14)) {
          for (const l of (h1.links || []).slice(0, 6)) {
            const t = resolve(l);
            if (t && nodeMap.size < 42) {
              addNode(t, 2);
              edges.push({ source: h1.path, target: t.path });
            }
          }
          for (const bp of (h1.backlinks || []).slice(0, 5)) {
            const bn = appState.byPath[bp];
            if (bn && nodeMap.size < 42) {
              addNode(bn, 2);
              edges.push({ source: bn.path, target: h1.path });
            }
          }
        }
      }
    }

    // Add cross-edges among included nodes
    const nodes = Array.from(nodeMap.values());
    const edgeKeys = new Set(edges.map((e) => `${e.source}->${e.target}`));
    for (const u of nodes) {
      for (const l of u.note.links || []) {
        const t = resolve(l);
        if (t && nodeMap.has(t.path) && u.id !== t.path) {
          const k = `${u.id}->${t.path}`;
          if (!edgeKeys.has(k)) {
            edgeKeys.add(k);
            edges.push({ source: u.id, target: t.path });
          }
        }
      }
    }

    return { nodes, edges };
  }

  function mountGraphCanvas(appState, openNoteFn) {
    const canvas = document.getElementById("ob-note-graph-canvas");
    if (!canvas) return;
    const centerPath = canvas.getAttribute("data-center-path") || appState.currentNotePath;
    const { nodes, edges } = buildGraphData(appState, centerPath, v2State.graphDepth);
    if (!nodes.length) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(300, rect.width || 680);
    const H = Math.max(260, rect.height || 360);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // Initial radial placement + spring relaxation
    const cx = W / 2;
    const cy = H / 2;
    const hop1 = nodes.filter((n) => n.hop === 1);
    const hop2 = nodes.filter((n) => n.hop >= 2);

    nodes.forEach((n) => {
      if (n.hop === 0) {
        n.x = cx;
        n.y = cy;
      }
    });
    hop1.forEach((n, idx) => {
      const ang = (2 * Math.PI * idx) / Math.max(1, hop1.length);
      const r = Math.min(W, H) * (hop2.length ? 0.25 : 0.34);
      n.x = cx + r * Math.cos(ang);
      n.y = cy + r * Math.sin(ang);
    });
    hop2.forEach((n, idx) => {
      const ang = (2 * Math.PI * idx) / Math.max(1, hop2.length) + 0.25;
      const r = Math.min(W, H) * 0.42;
      n.x = cx + r * Math.cos(ang);
      n.y = cy + r * Math.sin(ang);
    });

    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    // Run 45 force-relaxation steps for clean separation
    for (let step = 0; step < 45; step++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy) || 1;
          const minDist = 68;
          if (dist < minDist) {
            const push = ((minDist - dist) / dist) * 0.32;
            if (a.hop !== 0) {
              a.x -= dx * push;
              a.y -= dy * push;
            }
            if (b.hop !== 0) {
              b.x += dx * push;
              b.y += dy * push;
            }
          }
        }
      }
      nodes.forEach((n) => {
        if (n.hop === 0) {
          n.x = cx;
          n.y = cy;
        } else {
          n.x = Math.max(48, Math.min(W - 48, n.x));
          n.y = Math.max(26, Math.min(H - 26, n.y));
        }
      });
    }

    let hoverNode = null;
    let dragNode = null;
    let dragMoved = false;

    function draw() {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = isLight ? "#e6f0ef" : "#011d1c";
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = isLight ? "#d5e3e1" : "#0f4a46";
      ctx.lineWidth = 1;
      for (let gx = 40; gx < W; gx += 60) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 40; gy < H; gy += 60) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      // Edges
      edges.forEach((e) => {
        const s = byId[e.source];
        const t = byId[e.target];
        if (!s || !t) return;
        const active = hoverNode && (hoverNode.id === s.id || hoverNode.id === t.id);
        ctx.strokeStyle = active ? (isLight ? "#011d1c" : "#edfffe") : isLight ? "#8fa3a1" : "#1f6b65";
        ctx.lineWidth = active ? 2.2 : 1.2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      });

      // Nodes (ORDERBLOCK 0px square nodes!)
      nodes.forEach((n) => {
        const sz = n.hop === 0 ? 16 : n.hop === 1 ? 11 : 9;
        const isHover = hoverNode && hoverNode.id === n.id;
        ctx.fillStyle = n.color;
        ctx.fillRect(n.x - sz / 2, n.y - sz / 2, sz, sz);
        ctx.strokeStyle = isHover ? "#ffffff" : "#011d1c";
        ctx.lineWidth = isHover ? 3 : 2;
        ctx.strokeRect(n.x - sz / 2, n.y - sz / 2, sz, sz);

        ctx.font = n.hop === 0 ? '700 12px "Space Mono", sans-serif' : '600 11px "Work Sans", "Pretendard", sans-serif';
        ctx.fillStyle = isLight ? "#011d1c" : n.hop === 0 ? "#fde9ff" : "#edfffe";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + sz / 2 + 13);
      });
    }

    function nodeAt(px, py) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (Math.hypot(px - n.x, py - n.y) <= 18) return n;
      }
      return null;
    }

    canvas.onpointerdown = (ev) => {
      const r = canvas.getBoundingClientRect();
      const hit = nodeAt(ev.clientX - r.left, ev.clientY - r.top);
      if (hit) {
        dragNode = hit;
        dragMoved = false;
        canvas.setPointerCapture(ev.pointerId);
      }
    };
    canvas.onpointermove = (ev) => {
      const r = canvas.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      if (dragNode) {
        dragMoved = true;
        dragNode.x = Math.max(30, Math.min(W - 30, px));
        dragNode.y = Math.max(20, Math.min(H - 20, py));
        draw();
        return;
      }
      const hit = nodeAt(px, py);
      if (hit !== hoverNode) {
        hoverNode = hit;
        canvas.style.cursor = hit ? "pointer" : "grab";
        draw();
      }
    };
    canvas.onpointerup = () => {
      if (dragNode && !dragMoved && dragNode.id !== centerPath) {
        openNoteFn(dragNode.id);
      }
      dragNode = null;
    };

    draw();
  }

  /* ========================================================================
     3. SPLIT PANE SIDE-BY-SIDE READER & THOUGHT/THESIS EDITOR
     ======================================================================== */
  function renderSplitPaneRight(appState, renderMarkdownFn, serializeFmFn) {
    if (!v2State.splitActive) return "";

    const candidates = appState.notes.filter(
      (n) =>
        n.folder === "6. Resources/Stocks" ||
        n.top_folder === "6. Resources" ||
        n.top_folder === "1. Daily Note" ||
        n.top_folder === "9. Wiki"
    );

    const rightNote = appState.byPath[v2State.splitRightPath] || candidates[0];
    const fullRaw = rightNote ? serializeFmFn(rightNote.props, rightNote.body) : "";

    const optionsHtml = candidates
      .map(
        (n) =>
          `<option value="${esc(n.path)}" ${rightNote && n.path === rightNote.path ? "selected" : ""}>[${esc(
            n.props.kind || n.top_folder
          )}] ${esc(n.name)}</option>`
      )
      .join("");

    return `
      <section class="split-pane-right" aria-label="우측 비교·편집 창">
        <div class="note-top-meta" style="border-bottom-color:var(--ai);">
          <div style="flex:1;min-width:200px;">
            <div class="label" style="color:var(--ai);margin-bottom:4px;">SPLIT PANE // 좌측 원문 대조 · 우측 생각/논리 편집기</div>
            <select id="split-right-select" class="select" style="font-size:12.5px;padding:6px 8px;">
              ${optionsHtml}
            </select>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="ob-btn ob-btn--xs ${v2State.splitRightMode === "edit" ? "ob-btn--primary" : ""}" id="btn-split-mode-toggle">
              ${v2State.splitRightMode === "edit" ? "PREVIEW 👁️" : "EDIT ✏️"}
            </button>
            <button class="ob-btn ob-btn--ai ob-btn--xs" id="btn-split-new-thought">+ 새 생각 노트</button>
            <button class="ob-btn ob-btn--xs" id="btn-close-split">CLOSE [✕]</button>
          </div>
        </div>

        ${
          rightNote
            ? v2State.splitRightMode === "edit"
              ? `<div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
                    <span class="ob-mono" style="font-size:11.5px;color:var(--muted);">TARGET: ${esc(rightNote.path)}</span>
                    <button class="ob-btn ob-btn--ai ob-btn--xs" id="btn-split-insert-ai">+ 영구 생각 AI 확장 섹션 삽입</button>
                  </div>
                  <textarea id="split-right-textarea" class="textarea" style="min-height:460px;font-family:var(--font-mono);font-size:13px;margin-bottom:10px;">${esc(
                    fullRaw
                  )}</textarea>
                  <button class="ob-btn ob-btn--primary" id="btn-split-save" style="width:100%;">COMMIT RIGHT PANE TO VAULT +</button>
                </div>`
              : `<div class="md-body">${renderMarkdownFn(rightNote.body, rightNote)}</div>`
            : ""
        }
      </section>
    `;
  }

  /* ========================================================================
     4. DAILY NOTE HABIT & REVIEW CALENDAR HEATMAP (1. Daily Note/)
     ======================================================================== */
  function renderHabitHeatmapPanel(appState) {
    const dailyNotes = appState.notes.filter((n) => n.top_folder === "1. Daily Note" && /^\d{4}-\d{2}-\d{2}$/.test(n.name));
    const byDate = {};
    for (const n of dailyNotes) {
      byDate[n.name] = n;
    }

    const [yearStr, monthStr] = v2State.calMonth.split("-");
    const year = parseInt(yearStr, 10) || 2026;
    const month = parseInt(monthStr, 10) || 11;
    const firstDayDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    let totalHabitChecks = 0;
    let loggedDaysInMonth = 0;
    const cellsHtml = [];
    const dows = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    dows.forEach((d) => cellsHtml.push(`<div class="ob-cal-dow">${d}</div>`));

    for (let b = 0; b < firstDayDow; b++) {
      cellsHtml.push(`<div style="min-height:46px;"></div>`);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
      const note = byDate[dStr];
      const hEx = note && note.props["habit_운동"] === true;
      const hFast = note && note.props["habit_저녁금식"] === true;
      const hStudy = note && note.props["habit_공부"] === true;
      const score = (hEx ? 1 : 0) + (hFast ? 1 : 0) + (hStudy ? 1 : 0);
      if (note) loggedDaysInMonth++;
      totalHabitChecks += score;

      const heatClass = score === 3 ? "heat-3" : score === 2 ? "heat-2" : score === 1 ? "heat-1" : "heat-0";
      const isSel = dStr === v2State.calSelectedDate;
      const energy = note && note.props.energy ? `E:${note.props.energy}` : "";
      const dots = `${hEx ? "운✓" : "운·"} ${hFast ? "금✓" : "금·"} ${hStudy ? "공✓" : "공·"}`;

      cellsHtml.push(`
        <div class="ob-cal-cell ${heatClass} ${isSel ? "is-selected" : ""}" data-cal-date="${dStr}" title="${dStr} (${score}/3 습관)">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${String(day).padStart(2, "0")}</strong>
            ${energy ? `<span style="font-size:9.5px;">${esc(energy)}</span>` : note ? `<span>●</span>` : ""}
          </div>
          <div style="font-size:9.5px;line-height:1.2;letter-spacing:-0.3px;">${note ? dots : "−"}</div>
        </div>
      `);
    }

    const selNote = byDate[v2State.calSelectedDate];
    const p = selNote ? selNote.props : {};

    return `
      <div class="ob-card" style="margin-bottom:24px;">
        <div class="ob-card__head">
          <span>DAILY HABIT &amp; JOURNAL HEATMAP // 데일리 습관 · 에너지 · 회고 캘린더 (${esc(v2State.calMonth)})</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="ob-badge">기록일 ${loggedDaysInMonth}D</span>
            <span class="ob-badge ob-badge--low">습관 달성 ${totalHabitChecks}회</span>
          </div>
        </div>
        <div class="ob-card__body">
          <div class="grid-2">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <button class="ob-btn ob-btn--xs" id="btn-cal-prev">← PREV MONTH</button>
                <strong class="ob-mono" style="font-size:15px;color:var(--accent-ink);">${esc(v2State.calMonth)}</strong>
                <button class="ob-btn ob-btn--xs" id="btn-cal-next">NEXT MONTH →</button>
              </div>
              <div class="ob-cal-grid">${cellsHtml.join("")}</div>
              <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">
                <span>범례:</span>
                <span><strong style="color:var(--up);">■ 3/3 달성</strong></span>
                <span><strong>■ 2/3 달성</strong></span>
                <span>■ 1/3 달성</span>
                <span>● 데일리 노트 존재 (AGENTS.md 규칙: 미입력 습관은 추정하지 않고 실제 값만 표시)</span>
              </div>
            </div>

            <div style="background:var(--deep);border:3px solid var(--frame);padding:16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--frame);">
                <strong class="ob-mono" style="font-size:15px;color:var(--ink);">📅 ${esc(v2State.calSelectedDate)} 데일리 점검 · 회고</strong>
                ${
                  selNote
                    ? `<button class="ob-btn ob-btn--xs" data-note-path="${esc(selNote.path)}">OPEN NOTE →</button>`
                    : `<span class="ob-badge">미생성 (저장 시 자동 생성)</span>`
                }
              </div>

              <div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px;padding:10px;background:var(--surface);border:2px solid var(--frame);">
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:700;">
                  <input type="checkbox" id="cal-habit-ex" class="task-toggle" ${p["habit_운동"] === true ? "checked" : ""} />
                  <span>운동 (habit_운동)</span>
                </label>
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:700;">
                  <input type="checkbox" id="cal-habit-fast" class="task-toggle" ${p["habit_저녁금식"] === true ? "checked" : ""} />
                  <span>저녁금식 (habit_저녁금식)</span>
                </label>
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:700;">
                  <input type="checkbox" id="cal-habit-study" class="task-toggle" ${p["habit_공부"] === true ? "checked" : ""} />
                  <span>공부 (habit_공부)</span>
                </label>
                <div style="display:inline-flex;align-items:center;gap:6px;margin-left:auto;">
                  <span class="ob-mono" style="font-size:12px;">ENERGY (1~5):</span>
                  <input type="number" id="cal-energy" class="input" min="1" max="5" value="${esc(p.energy ?? "")}" style="width:64px;padding:4px 8px;" />
                </div>
              </div>

              <div class="form-row">
                <div style="flex:1;">
                  <label class="label" style="font-size:11px;display:block;margin-bottom:2px;">ONE THING // 오늘 가장 중요한 1개</label>
                  <input type="text" id="cal-one-thing" class="input" value="${esc(p.one_thing ?? "")}" placeholder="오늘의 핵심 1가지" style="padding:6px 10px;" />
                </div>
                <div style="flex:1;">
                  <label class="label" style="font-size:11px;display:block;margin-bottom:2px;">WIN // 오늘 해낸 것</label>
                  <input type="text" id="cal-win" class="input" value="${esc(p.win ?? "")}" placeholder="성취한 일" style="padding:6px 10px;" />
                </div>
              </div>

              <div class="form-row">
                <div style="flex:1;">
                  <label class="label" style="font-size:11px;display:block;margin-bottom:2px;">MISS // 놓친 것</label>
                  <input type="text" id="cal-miss" class="input" value="${esc(p.miss ?? "")}" placeholder="아쉬운 점" style="padding:6px 10px;" />
                </div>
                <div style="flex:1;">
                  <label class="label" style="font-size:11px;display:block;margin-bottom:2px;">TOMORROW // 내일 하나만 바꾼다면</label>
                  <input type="text" id="cal-tomorrow" class="input" value="${esc(p.tomorrow ?? "")}" placeholder="내일 행동" style="padding:6px 10px;" />
                </div>
              </div>

              <button class="ob-btn ob-btn--primary ob-btn--sm" id="btn-save-daily-habit" style="width:100%;margin-top:6px;">
                COMMIT DAILY HABITS &amp; REVIEW (${esc(v2State.calSelectedDate)}) +
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.SIGMA_V2 = {
    state: v2State,
    renderEarningsChartPanel,
    renderGraphPanel,
    mountGraphCanvas,
    renderSplitPaneRight,
    renderHabitHeatmapPanel,
  };
})();
