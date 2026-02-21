import { cn } from '@/lib/utils';

export function CompanyProfile() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight text-foreground">Company Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Brand identity, vision, values, and long-term targets for The Roof
          </p>
        </div>
      </div>

      {/* Section: Who We Are */}
      <div className="flex items-center gap-3">
        <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase whitespace-nowrap">
          The Roof — Club &amp; Lounge
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_0.5fr]">

        {/* Card 1: The Roof — Who We Are */}
        <div className="rounded-card border border-border bg-card px-6 py-5 shadow-card">
          <div className="font-display text-lg tracking-[3px] text-foreground mb-5">The Roof — Who We Are</div>
          <div className="space-y-5">
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-2">Company</div>
              <p className="text-sm font-body text-secondary-foreground leading-relaxed">
                Da Nang's beachside rooftop destination, transforming from a stylish sunset lounge into a vibrant dancefloor after dark. Inspired by the warm, exotic atmosphere of Marrakech, we offer an unforgettable rooftop experience above My Khe Beach.
              </p>
              <p className="mt-2 text-sm font-body text-secondary-foreground leading-relaxed">
                Located on the third floor with panoramic ocean views. Live DJs every Wednesday–Saturday, creating the perfect balance between laid-back afternoons and high-energy nights.
              </p>
              <p className="mt-2 text-sm font-body text-secondary-foreground leading-relaxed">
                Known for premium cocktails, curated music, and one of the best shisha experiences in Da Nang — the go-to spot for sunset drinks, social nights, and an international crowd.
              </p>
            </div>
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-1.5">Niche</div>
              <p className="text-sm font-body text-secondary-foreground leading-relaxed">
                A unique blend of global influences creating an international atmosphere that brings people together — bridging the gap between east and west. A relaxing, inviting space where the music doesn't blow your head off.
              </p>
            </div>
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-2">Three Uniques</div>
              <ol className="space-y-2 text-sm font-body text-secondary-foreground">
                <li>
                  <span className="text-foreground font-medium">① Our View</span>
                  <span className="text-muted-foreground"> — </span>
                  Panoramic views of My Khe Beach. Perfect for sunset evenings and relaxing nights in paradise.
                </li>
                <li>
                  <span className="text-foreground font-medium">② The Atmosphere</span>
                  <span className="text-muted-foreground"> — </span>
                  Laidback, relaxing, genuine and unique — including the events.
                </li>
                <li>
                  <span className="text-foreground font-medium">③ The Offerings</span>
                  <span className="text-muted-foreground"> — </span>
                  High quality shisha, refreshing cocktails at a reasonable price, attractive promotions and good food.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Card 2: Identity */}
        <div className="rounded-card border border-border bg-card px-6 py-5 shadow-card">
          <div className="font-display text-lg tracking-[3px] text-foreground mb-5">Identity</div>
          <div className="space-y-5">
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-1.5">Vision</div>
              <p className="text-sm font-light italic text-secondary-foreground leading-relaxed">
                We aim to become a melting pot of culture, where diverse backgrounds, ideas, and experiences come together to create a vibrant, inclusive space. We celebrate the richness of different cultures and believe in the power of unity through shared experiences and connection.
              </p>
            </div>
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-3">Values</div>
              <div className="space-y-3">
                {[
                  { name: "Fun & Positive", desc: "We bring a fun and positive energy to everything we do." },
                  { name: "Down to Earth", desc: "We embrace freedom of expression and show up as our true selves." },
                  { name: "Teamwork", desc: "We are a team of service-oriented individuals focused on guests' needs, working hard and lifting each other up." },
                  { name: "Attitude", desc: "We are individuals with a growth mindset, always striving to improve and evolve." },
                  { name: "Care", desc: "We genuinely prioritize the comfort and wellbeing of our guests, venue, partners and team." },
                ].map((v) => (
                  <div key={v.name} className="flex gap-2">
                    <span className="rounded-full border border-primary/25 bg-primary/8 px-2.5 py-0.5 text-xs text-primary shrink-0 h-fit mt-0.5">{v.name}</span>
                    <p className="text-xs text-secondary-foreground leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Targets */}
        <div className="rounded-card border border-border bg-card px-6 py-5 shadow-card">
          <div className="font-display text-lg tracking-[3px] text-foreground mb-5">Targets</div>
          <div className="space-y-5">
            {[
              {
                label: "10 Year Target",
                year: "2035",
                items: [
                  "6,000 Monthly pax (avg)",
                  "2.0B VND revenue / month (avg)",
                  "25B VND for the year",
                  "9B VND in profits",
                  "35% Net profit target",
                ],
              },
              {
                label: "3 Year Target",
                year: "2028",
                items: [
                  "4,250 Monthly pax (avg)",
                  "1.5B VND revenue / month (avg)",
                  "18B VND for the year",
                  "6B VND in profits",
                  "35% Net profit target",
                ],
              },
              {
                label: "1 Year Target",
                year: "2026",
                items: [
                  "2,500 Monthly pax (avg)",
                  "1.0B VND revenue / month (avg)",
                  "9B VND for the year",
                  "3B VND in profits",
                  "30% Net profit target",
                ],
              },
            ].map((target, i) => (
              <div key={target.year} className={cn(i > 0 ? "border-t border-border pt-5" : "")}>
                <div className="flex items-baseline gap-2 mb-2">
                  <div className="text-xs tracking-widest font-semibold text-foreground uppercase">{target.label}</div>
                  <div className="text-xs text-primary border border-primary/25 bg-primary/8 rounded-sm px-1.5 py-0.5">{target.year}</div>
                </div>
                <ul className="space-y-1">
                  {target.items.map((item) => (
                    <li key={item} className="flex items-start gap-1.5 text-xs text-secondary-foreground">
                      <span className="mt-[3px] h-1 w-1 rounded-full bg-primary/50 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default CompanyProfile;
