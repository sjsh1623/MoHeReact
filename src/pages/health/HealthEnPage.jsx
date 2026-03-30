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

export default function HealthEnPage() {
  return (
    <div className={styles.page}>

      {/* ════════ HERO ════════ */}
      <section className={styles.hero}>
        <span className={styles.heroGlow1} />
        <span className={styles.heroGlow2} />

        <span className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} />
          Premium Gut Health Food
        </span>

        <div className={styles.heroImgWrap}>
          <img src={IMG.hero} alt="GoodbyeTox" />
        </div>

        <span className={styles.heroEn}>Goodbye Tox</span>
        <span className={styles.heroName}>
          Goodbye<span className={styles.heroNameEm}>Tox</span>
        </span>
        <span className={styles.heroDesc}>
          Psyllium Husk Dietary Fiber + 17-Strain Probiotics<br />
          A complete gut health &amp; bowel care solution
        </span>

        <div className={styles.heroPills}>
          <span className={styles.heroPill}>#PsylliumHusk</span>
          <span className={styles.heroPill}>#17Probiotics</span>
          <span className={styles.heroPill}>#DietaryFiber</span>
          <span className={styles.heroPill}>#GutHealth</span>
          <span className={styles.heroPill}>#RiceBran</span>
        </div>
      </section>

      <div className={styles.summaryBar}>
        <span className={styles.summaryIcon}>💡</span>
        <span className={styles.summaryTextWrap}>
          <span className={styles.summaryStrong}>Psyllium Husk Fiber + Probiotic Complex</span>
          <span className={styles.summarySub}>Gut Motility · Bowel Regularity · Gut Environment · Beneficial Bacteria Growth</span>
        </span>
      </div>

      {/* ════════ KEY BENEFITS ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />Key Benefits</span>
        <span className={styles.h2}>4 Core Effects</span>
        <span className={styles.body}>A scientifically formulated complex that improves gut health step by step.</span>

        <div className={styles.benefitGrid}>
          {[
            ['🔄','Effect 01','Promotes Gut Motility','Soluble fiber absorbs water, expands in volume, and naturally stimulates intestinal movement.'],
            ['✅','Effect 02','Improves Bowel Regularity','Supports smooth and regular bowel movements for daily digestive comfort.'],
            ['🌱','Effect 03','Gut Environment Reset','Helps eliminate intestinal waste and maintain a healthy gut environment.'],
            ['🦠','Effect 04','Beneficial Bacteria Growth','17-strain probiotic blend multiplies beneficial bacteria and restores gut balance.'],
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

      {/* ════════ INGREDIENTS ════════ */}
      <section className={styles.secAlt}>
        <span className={styles.label}><span className={styles.labelLine} />Ingredients</span>
        <span className={styles.h2}>4 Core Ingredients</span>
        <span className={styles.body}>Scientifically blended natural ingredients, working in synergy for maximum gut health.</span>

        <div className={styles.ingList}>
          {[
            { color:'#1a7a45', emoji:'🌾', name:'Psyllium Husk', sub:'차전자피 · Primary Ingredient', tags:['Soluble Fiber','Gut Health','Bowel Support'] },
            { color:'#c8a84b', emoji:'🌾', name:'Rice Bran Powder', sub:'미강 · Bran Extract', tags:['GABA','Gamma-Oryzanol','Antioxidant'] },
            { color:'#8b6c3a', emoji:'🌽', name:'Grain Blend Powder', sub:'곡물 혼합 · Brown Rice · Barley · Soy · Black Rice', tags:['Fiber','Protein','Antioxidant'] },
            { color:'#4b7abd', emoji:'🔬', name:'17-Strain Probiotic Blend', sub:'혼합 유산균 · Probiotic Complex', tags:['Beneficial Bacteria','Gut Balance'] },
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

      {/* ════════ PSYLLIUM HUSK ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />Primary Ingredient</span>
        <span className={styles.h2}>What Is Psyllium Husk?</span>
        <span className={styles.body}>
          Extracted from the outer husk of Plantago ovata seeds,<br />
          exceptionally rich in soluble dietary fiber for superior gut health.
        </span>

        <div className={styles.featureBox}>
          <img src={IMG.psyllium} alt="Psyllium Husk — wheat field" className={styles.featureImg} />
          <div className={styles.featureBody}>
            <span className={styles.featureTag}>Core Mechanism</span>
            <span className={styles.h3}>Absorbs Water → Expands → Stimulates Gut Movement</span>
            <span className={styles.featureDesc}>
              When Psyllium Husk meets water, it forms a gel and expands significantly,
              stimulating the intestinal wall. This physical action triggers peristaltic
              movement and supports regular bowel activity.
            </span>

            <div className={styles.mechBox}>
              {[
                'Psyllium Husk dietary fiber intake',
                'Water absorption → gel formation, volume expansion',
                'Intestinal wall stimulation → promotes peristalsis',
                'Regular bowel activity + sustained gut health',
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

      {/* ════════ RICE BRAN ════════ */}
      <div className={styles.secNoPadAlt}>
        <div className={styles.imgBanner}>
          <img src={IMG.ricebran} alt="Rice Bran" />
          <div className={styles.imgBannerOverlay}>
            <span className={styles.imgBannerTitle}>Rice Bran Powder</span>
            <span className={styles.imgBannerDesc}>GABA · Gamma-Oryzanol · Dietary Fiber — 3-in-1 supply</span>
          </div>
        </div>

        <div className={styles.secInner}>
          <span className={styles.label}><span className={styles.labelLine} />Supporting Ingredient</span>
          <span className={styles.h2}>Rice Bran Key Components</span>
          <span className={styles.body}>Rice bran extract delivers three functional components simultaneously.</span>
        </div>
        <div className={styles.secInnerBottom}>
          <div className={styles.miniGrid}>
            {[
              ['🧠','GABA','Gamma-aminobutyric acid that may help support nervous system balance'],
              ['⚡','Gamma-Oryzanol','Antioxidant properties unique to rice bran'],
              ['🌾','Dietary Fiber','Gut health support, synergizes with Psyllium Husk'],
              ['🛡️','Antioxidant Complex','Protects cells from oxidative stress damage'],
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

      {/* ════════ GRAIN BLEND ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />Grain Ingredients</span>
        <span className={styles.h2}>Grain Blend Powder</span>
        <span className={styles.body}>Four grains, one formula. Balanced fiber, protein, and antioxidants.</span>

        <div className={styles.grainGrid}>
          {[
            [IMG.grainBrown,  'Brown Rice', 'Rich in Dietary Fiber', '🌾'],
            [IMG.grainBarley, 'Barley',     'Rich in Dietary Fiber', '🌿'],
            [IMG.grainSoy,    'Soybean',    'Plant-Based Protein',   '🫘'],
            [IMG.grainBlack,  'Black Rice', 'Antioxidant Properties','🫙'],
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

      {/* ════════ PROBIOTICS ════════ */}
      <section className={styles.secDark}>
        <span className={styles.labelLight}><span className={styles.labelLine} />Probiotics</span>
        <span className={styles.proCount}>17</span>
        <span className={styles.proCountSub}>Probiotic Strain Complex</span>
        <span className={styles.h2Light}>Gut Health &amp; Microbiome Balance</span>
        <span className={styles.bodyLight}>
          17 strains from Lactobacillus, Bifidobacterium, and Streptococcus families
          work together to grow beneficial bacteria and restore gut flora balance.
        </span>

        <div className={styles.proList}>
          {[
            ['Lactobacillus strains','Beneficial bacteria growth'],
            ['Bifidobacterium strains','Gut environment improvement'],
            ['Streptococcus strains','Microbiome balance'],
            ['Jindo Mushroom Extract','Immune support · Antioxidant'],
            ['Postbiotics (Velofabrix Actinobox)','Gut health maintenance'],
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

      {/* ════════ HOW IT WORKS ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />Mechanism</span>
        <span className={styles.h2}>How It Works</span>
        <span className={styles.body}>Physical fiber action + probiotic biochemistry — a multi-stage gut health system.</span>

        <div className={styles.flowList}>
          {[
            ['Dietary Fiber Intake','Combined fiber from Psyllium Husk, Rice Bran & Grains'],
            ['Water Absorption → Volume Expansion','Soluble fiber transforms into a gel, expanding in the gut'],
            ['Gut Motility Stimulated','Physical expansion triggers natural peristaltic movement'],
            ['Probiotic Activation','17-strain probiotics grow beneficial bacteria & restore balance'],
            ['Bowel Support + Sustained Gut Health','Regular bowel activity · Improved gut environment'],
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

      {/* ════════ HOW TO TAKE ════════ */}
      <section className={styles.secAlt}>
        <span className={styles.label}><span className={styles.labelLine} />Usage</span>
        <span className={styles.h2}>How To Take</span>

        <div className={styles.howList}>
          {[
            ['📅','1–2 times daily','Consistent use maximizes effectiveness'],
            ['💧','Take with plenty of water','Recommended with 200ml or more of water'],
            ['🍽️','Best taken before meals','30 minutes before eating or on an empty stomach'],
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

      {/* ════════ CAUTIONS ════════ */}
      <section className={styles.sec}>
        <span className={styles.label}><span className={styles.labelLine} />Cautions</span>
        <span className={styles.h2}>Usage Precautions</span>

        <div className={styles.cautionList}>
          {[
            ['⚠️','Avoid Excessive Intake','Excessive consumption may cause bloating. Please follow the recommended serving size.'],
            ['🔍','Check for Allergens','If you have soy or grain allergies, please review the ingredient list carefully before use.'],
            ['👤','Individual Variation','Results may vary between individuals. Discontinue use if adverse reactions occur.'],
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

      {/* ════════ PRODUCT INFO ════════ */}
      <section className={styles.secAlt}>
        <span className={styles.label}><span className={styles.labelLine} />Product Info</span>
        <span className={styles.h2}>Product Information</span>

        <div className={styles.infoTable}>
          {[
            ['Product Type','General Food · Not a regulated health supplement'],
            ['Purpose','Dietary fiber-based food to support gut health and bowel regularity'],
            ['Key Ingredients','Psyllium Husk, Rice Bran, Grain Blend, 17-Strain Probiotics'],
            ['Note','Not intended to diagnose, treat, cure, or prevent disease'],
            ['Special Groups','Pregnant women and those with special conditions should consult a professional'],
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
