import styles from '@/styles/pages/health/health-page.module.css';

const IMG = {
  hero:       'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=440&h=440&q=85',
  psyllium:   'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=750&h=280&q=85',
  ricebran:   'https://images.unsplash.com/photo-1536304993881-ff86e0c9c745?auto=format&fit=crop&w=750&h=280&q=85',
  grainBrown: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=370&h=140&q=80',
  grainBarley:'https://images.unsplash.com/photo-1484565012893-b5e79669e9a1?auto=format&fit=crop&w=370&h=140&q=80',
  grainSoy:   'https://images.unsplash.com/photo-1519058082700-08a0b56da9b4?auto=format&fit=crop&w=370&h=140&q=80',
  grainBlack: 'https://images.unsplash.com/photo-1602253057119-44d745d9b860?auto=format&fit=crop&w=370&h=140&q=80',
};

export default function HealthKoPage() {
  return (
    <div className={styles.page}>

      {/* ════════ HERO ════════ */}
      <section className={styles.hero}>
        <span className={styles.heroGlow1} />
        <span className={styles.heroGlow2} />

        <span className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} />
          장 건강 프리미엄 케어 식품
        </span>

        <div className={styles.heroImgWrap}>
          <img src={IMG.hero} alt="굿바이톡스" />
        </div>

        <span className={styles.heroEn}>Goodbye Tox</span>
        <span className={styles.heroName}>
          굿바이<span className={styles.heroNameEm}>톡스</span>
        </span>
        <span className={styles.heroDesc}>
          차전자피 식이섬유 + 17종 유산균이 결합된<br />
          장 건강 &amp; 배변 활동 케어 솔루션
        </span>

        <div className={styles.heroPills}>
          <span className={styles.heroPill}>#차전자피</span>
          <span className={styles.heroPill}>#유산균 17종</span>
          <span className={styles.heroPill}>#식이섬유</span>
          <span className={styles.heroPill}>#장건강</span>
          <span className={styles.heroPill}>#미강</span>
        </div>
      </section>

      {/* 요약 바 */}
      <div className={styles.summaryBar}>
        <span className={styles.summaryIcon}>💡</span>
        <span className={styles.summaryTextWrap}>
          <span className={styles.summaryStrong}>차전자피 식이섬유 + 유산균 복합 설계</span>
          <span className={styles.summarySub}>장 운동 촉진 · 배변 활동 도움 · 장내 환경 개선 · 유익균 증식</span>
        </span>
      </div>

      {/* ════════ 기대 효과 ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />기대 효과</span>
        <span className={styles.h2}>4가지 핵심 효과</span>
        <span className={styles.body}>과학적으로 설계된 복합 성분이 장 건강을 단계적으로 개선합니다.</span>

        <div className={styles.benefitGrid}>
          {[
            ['🔄','Effect 01','장 운동 촉진','수용성 식이섬유가 수분을 흡수해 부피를 늘리고 자연스러운 장 운동을 유도합니다.'],
            ['✅','Effect 02','배변 활동 개선','원활한 배변 활동으로 속을 편안하게 유지하는 데 도움을 줍니다.'],
            ['🌱','Effect 03','장내 환경 개선','노폐물 배출을 돕고 장내 환경을 건강하게 유지합니다.'],
            ['🦠','Effect 04','유익균 증식','17종 유산균 복합체로 장내 유익균을 늘리고 균형을 회복합니다.'],
          ].map(([icon, num, title, desc]) => (
            <div key={num} className={styles.benefitCard}>
              <span className={styles.benefitIcon}>{icon}</span>
              <span className={styles.benefitNum}>{num}</span>
              <span className={styles.benefitTitle}>{title}</span>
              <span className={styles.benefitDesc}>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.div} />

      {/* ════════ 원재료 구성 ════════ */}
      <section className={styles.secAlt}>
        <span className={styles.label}><span className={styles.labelLine} />원재료 구성</span>
        <span className={styles.h2}>4가지 핵심 원료</span>
        <span className={styles.body}>자연에서 얻은 원료를 과학적으로 배합하여 장 건강 시너지를 극대화했습니다.</span>

        <div className={styles.ingList}>
          {[
            { color:'#1a7a45', emoji:'🌾', name:'차전자피', sub:'Psyllium Husk · 주원료', tags:['수용성 식이섬유','장 건강','배변 활동'] },
            { color:'#c8a84b', emoji:'🌾', name:'미강 분말', sub:'Rice Bran · 쌀겨 추출', tags:['GABA','감마오리자놀','항산화'] },
            { color:'#8b6c3a', emoji:'🌽', name:'곡물 혼합분말', sub:'Grain Blend · 현미·보리·대두·흑미', tags:['식이섬유','단백질','항산화'] },
            { color:'#4b7abd', emoji:'🔬', name:'17종 혼합 유산균', sub:'Probiotic Blend · 프로바이오틱스', tags:['유익균 증식','장내 균형'] },
          ].map(item => (
            <div key={item.name} className={styles.ingCard}>
              <span className={styles.ingStripe} style={{ background: item.color }} />
              <div className={styles.ingBody}>
                <span className={styles.ingEmoji}>{item.emoji}</span>
                <div>
                  <span className={styles.ingName}>{item.name}</span>
                  <span className={styles.ingSub}>{item.sub}</span>
                  <div className={styles.ingTags}>
                    {item.tags.map(t => <span key={t} className={styles.ingTag}>{t}</span>)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.div} />

      {/* ════════ 차전자피 주원료 상세 ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />주원료 상세</span>
        <span className={styles.h2}>차전자피란?</span>
        <span className={styles.body}>
          질경이 씨앗 껍질에서 추출한 고농축 식이섬유.<br />
          수용성 식이섬유 함량이 특히 높아 장 건강에 탁월한 효과를 발휘합니다.
        </span>

        <div className={styles.featureBox}>
          <img src={IMG.psyllium} alt="차전자피 밀밭" className={styles.featureImg} />
          <div className={styles.featureBody}>
            <span className={styles.featureTag}>핵심 작용 원리</span>
            <span className={styles.h3}>수분 흡수 → 부피 증가 → 장 운동 촉진</span>
            <span className={styles.featureDesc}>
              차전자피는 물과 만나면 겔 형태로 팽창하며 장 내벽을 자극합니다.
              이 자연스러운 물리적 작용이 연동 운동을 유도하고
              배변 활동을 원활하게 만들어 줍니다.
            </span>

            <div className={styles.mechBox}>
              {[
                '차전자피 식이섬유 섭취',
                '수분 흡수 → 겔 형태로 부피 증가',
                '장 내벽 자극 → 장 운동 촉진',
                '배변 활동 원활 + 장 건강 유지',
              ].map((text, i, arr) => (
                <span key={i}>
                  <span className={styles.mechStep}>
                    <span className={styles.mechDot} />
                    <span className={styles.mechText}>{text}</span>
                  </span>
                  {i < arr.length - 1 && <span className={styles.mechArrow}>▼</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.div} />

      {/* ════════ 미강 성분 ════════ */}
      <div className={styles.secNoPadAlt}>
        <div className={styles.imgBanner}>
          <img src={IMG.ricebran} alt="쌀/미강" />
          <div className={styles.imgBannerOverlay}>
            <span className={styles.imgBannerTitle}>미강 분말 (쌀겨)</span>
            <span className={styles.imgBannerDesc}>GABA · 감마오리자놀 · 식이섬유 3종 복합 공급</span>
          </div>
        </div>

        <div className={styles.secInner}>
          <span className={styles.label}><span className={styles.labelLine} />보조 성분</span>
          <span className={styles.h2}>미강 분말의 핵심 성분</span>
          <span className={styles.body}>쌀겨에서 추출한 미강 분말은 세 가지 기능성 성분을 동시에 공급합니다.</span>
        </div>
        <div className={styles.secInnerBottom}>
          <div className={styles.miniGrid}>
            {[
              ['🧠','GABA','신경 안정에 도움을 줄 수 있는 감마 아미노부티르산'],
              ['⚡','감마오리자놀','항산화 작용 · 미강 특유의 기능 성분'],
              ['🌾','식이섬유','장 건강 도움 · 차전자피와 시너지 효과'],
              ['🛡️','항산화 복합','산화 스트레스로부터 세포를 보호'],
            ].map(([icon, title, desc]) => (
              <div key={title} className={styles.miniCard}>
                <span className={styles.miniIcon}>{icon}</span>
                <span className={styles.miniTitle}>{title}</span>
                <span className={styles.miniDesc}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.div} />

      {/* ════════ 곡물 혼합 ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />곡물 원료</span>
        <span className={styles.h2}>곡물 혼합분말</span>
        <span className={styles.body}>4가지 곡물의 영양소를 한 번에. 식이섬유·단백질·항산화를 균형 있게 공급합니다.</span>

        <div className={styles.grainGrid}>
          {[
            [IMG.grainBrown,  '현미', '풍부한 식이섬유', '🌾'],
            [IMG.grainBarley, '보리', '풍부한 식이섬유', '🌿'],
            [IMG.grainSoy,    '대두', '식물성 단백질',   '🫘'],
            [IMG.grainBlack,  '흑미', '항산화 작용',     '🫙'],
          ].map(([src, name, benefit, fallback]) => (
            <div key={name} className={styles.grainCard}>
              <img src={src} alt={name} className={styles.grainImg}
                onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }} />
              <span className={styles.grainImgFallback} style={{ display:'none' }}>{fallback}</span>
              <div className={styles.grainInfo}>
                <span className={styles.grainName}>{name}</span>
                <span className={styles.grainBenefit}>{benefit}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.div} />

      {/* ════════ 유산균 17종 ════════ */}
      <section className={styles.secDark}>
        <span className={styles.labelLight}><span className={styles.labelLine} />프로바이오틱스</span>
        <span className={styles.proCount}>17종</span>
        <span className={styles.proCountSub}>혼합 유산균 복합체</span>
        <span className={styles.h2Light}>장 건강 &amp; 장내 균형 유지</span>
        <span className={styles.bodyLight}>
          Lactobacillus · Bifidobacterium · Streptococcus 계열의 17종 유산균이
          장내 유익균을 증식하고 건강한 균형을 유지합니다.
        </span>

        <div className={styles.proList}>
          {[
            ['Lactobacillus 계열', '유익균 증식'],
            ['Bifidobacterium 계열', '장내 환경 개선'],
            ['Streptococcus 계열', '균형 유지'],
            ['진도버섯 추출물', '면역 · 항산화'],
            ['사균체 (벨로파브릭스 아티노박스)', '장 건강 유지'],
          ].map(([name, detail]) => (
            <div key={name} className={styles.proItem}>
              <span className={styles.proBullet} />
              <span className={styles.proName}>{name}</span>
              <span className={styles.proDetail}>{detail}</span>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.div} />

      {/* ════════ 작용 원리 ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />작용 원리</span>
        <span className={styles.h2}>이렇게 작용합니다</span>
        <span className={styles.body}>
          식이섬유의 물리적 작용 + 유산균의 생화학적 작용이 결합하여
          장 건강을 단계적으로 개선합니다.
        </span>

        <div className={styles.flowList}>
          {[
            ['식이섬유 섭취', '차전자피 + 미강 + 곡물 식이섬유 복합 공급'],
            ['수분 흡수 → 부피 증가', '수용성 식이섬유가 겔 형태로 팽창'],
            ['장 운동 촉진', '물리적 자극으로 자연스러운 연동 운동 유도'],
            ['유산균 활성화', '17종 유산균으로 유익균 증식 · 장내 균형'],
            ['배변 활동 도움 + 장 건강 유지', '원활한 배변 · 장내 환경 개선'],
          ].map(([title, desc], i, arr) => (
            <span key={i}>
              <div className={styles.flowItem}>
                <span className={styles.flowNum}>{i + 1}</span>
                <div>
                  <span className={styles.flowTitle}>{title}</span>
                  <span className={styles.flowDesc}>{desc}</span>
                </div>
              </div>
              {i < arr.length - 1 && (
                <div className={styles.flowConnector}>
                  <span className={styles.flowConnectorLine} />
                </div>
              )}
            </span>
          ))}
        </div>
      </section>

      <div className={styles.div} />

      {/* ════════ 섭취 방법 ════════ */}
      <section className={styles.secAlt}>
        <span className={styles.label}><span className={styles.labelLine} />섭취 방법</span>
        <span className={styles.h2}>이렇게 드세요</span>

        <div className={styles.howList}>
          {[
            ['📅', '1일 1~2회 섭취', '꾸준한 섭취로 효과를 높이세요'],
            ['💧', '충분한 물과 함께', '200ml 이상의 물과 함께 섭취 권장'],
            ['🍽️', '식사 전 섭취 권장', '식사 30분 전 공복 또는 식사 전 섭취'],
          ].map(([emoji, title, sub]) => (
            <div key={title} className={styles.howItem}>
              <span className={styles.howEmoji}>{emoji}</span>
              <div>
                <span className={styles.howTitle}>{title}</span>
                <span className={styles.howSub}>{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.div} />

      {/* ════════ 주의사항 ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />주의사항</span>
        <span className={styles.h2}>섭취 시 주의사항</span>

        <div className={styles.cautionList}>
          {[
            ['⚠️','과다 섭취 주의','과도한 섭취 시 복부 팽만감이 나타날 수 있습니다. 권장량을 준수해 주세요.'],
            ['🔍','알레르기 원료 확인','대두, 곡물류 알레르기가 있는 경우 원재료를 반드시 확인 후 섭취하세요.'],
            ['👤','개인 체질 차이','체질에 따라 효과 및 반응에 차이가 있을 수 있습니다. 이상 반응 시 섭취를 중단하세요.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className={styles.cautionItem}>
              <span className={styles.cautionIcon}>{icon}</span>
              <div>
                <span className={styles.cautionTitle}>{title}</span>
                <span className={styles.cautionDesc}>{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.div} />

      {/* ════════ 제품 정보 ════════ */}
      <section className={styles.secAlt}>
        <span className={styles.label}><span className={styles.labelLine} />제품 정보</span>
        <span className={styles.h2}>제품 정보 및 안내</span>

        <div className={styles.infoTable}>
          {[
            ['제품 유형', '건강기능식품 아님 · 일반 식품'],
            ['용도', '장 건강 및 배변 활동 도움을 위한 식이섬유 기반 식품'],
            ['주원료', '차전자피, 미강, 곡물 혼합, 유산균 17종'],
            ['안내사항', '질병 예방·치료 목적의 의약품이 아닙니다'],
            ['임산부·특이체질', '전문가 상담 후 섭취 권장'],
          ].map(([key, val]) => (
            <div key={key} className={styles.infoRow}>
              <span className={styles.infoKey}>{key}</span>
              <span className={styles.infoVal}>{val}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
