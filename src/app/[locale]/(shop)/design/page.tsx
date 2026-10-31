import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArchFrame } from "@/components/brand/arch-frame";
import { Arcade } from "@/components/brand/arcade";
import { PriceTicket } from "@/components/brand/price-ticket";
import { VerificationSeal, type VerificationLevel } from "@/components/brand/verification-seal";

// Development-only preview of the signature components. Production builds return 404.
export const metadata: Metadata = {
  title: "Design preview",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

const LEVELS: VerificationLevel[] = [
  "UNVERIFIED",
  "DOCUMENTS_VERIFIED",
  "BUSINESS_VERIFIED",
  "PHYSICAL_SHOP_VERIFIED",
  "TRUSTED_VENDOR",
];

// Simple product silhouettes in place of real photos
function Phone() {
  return <div className="absolute inset-x-0 bottom-4 mx-auto h-[60%] w-[32%] rounded-lg bg-ink" />;
}
function Watch() {
  return <div className="absolute inset-x-0 bottom-[18%] mx-auto aspect-square w-[44%] rounded-full border-[6px] border-ink" />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-gold pt-5">
      <h2 className="type-h2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default async function DesignPreviewPage({ params }: Props) {
  if (process.env.NODE_ENV === "production") notFound();

  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex flex-col gap-12">
      <h1 className="type-display text-ink">Design preview</h1>

      <Section title="Verification seals">
        <div className="flex flex-wrap items-center gap-6">
          {LEVELS.map((level) =>
            level === "UNVERIFIED" ? (
              <span key={level} className="type-caption text-ink-muted">
                Unverified: no seal
              </span>
            ) : (
              <VerificationSeal key={level} level={level} size="lg" withLabel />
            ),
          )}
        </div>
        <div className="flex items-center gap-4">
          <VerificationSeal level="PHYSICAL_SHOP_VERIFIED" size="sm" />
          <VerificationSeal level="PHYSICAL_SHOP_VERIFIED" size="md" />
          <VerificationSeal level="PHYSICAL_SHOP_VERIFIED" size="lg" />
          <span className="type-caption text-ink-muted">sizes sm, md, lg</span>
        </div>
      </Section>

      <Section title="Price tickets">
        <div className="flex flex-wrap items-center gap-6">
          <PriceTicket amount={38500} on="page" />
          <PriceTicket amount={38500} msrp={41999} on="page" />
          <PriceTicket amount={150000} on="page" />
          <PriceTicket amount={38500} msrp={41999} size="lg" on="page" />
        </div>
      </Section>

      <Section title="Arch frames">
        <div className="grid grid-cols-3 gap-4 md:max-w-xl">
          <ArchFrame ratio="portrait" className="bg-highlight-soft">
            <Phone />
          </ArchFrame>
          <ArchFrame ratio="tall" className="bg-info-soft">
            <Watch />
          </ArchFrame>
          <ArchFrame ratio="square" className="bg-brand" />
        </div>
      </Section>

      <Section title="Product card (sample)">
        <div className="grid max-w-md grid-cols-2 gap-3">
          <article className="flex flex-col gap-2 rounded-md border bg-card p-2 pb-3 shadow-card">
            <ArchFrame className="bg-highlight-soft">
              <Phone />
            </ArchFrame>
            <div className="flex items-start justify-between gap-1">
              <h3 className="type-body-medium text-ink">Galaxy A55 5G</h3>
              <VerificationSeal level="PHYSICAL_SHOP_VERIFIED" size="sm" />
            </div>
            <p className="type-caption text-ink-muted">TechZone · 6 shops</p>
            <PriceTicket amount={38500} className="self-start" />
            <p className="type-caption border-t border-dashed border-gold pt-1.5 text-highlight">Make an offer</p>
          </article>
          <article className="flex flex-col gap-2 rounded-md border bg-card p-2 pb-3 shadow-card">
            <ArchFrame className="bg-info-soft">
              <Watch />
            </ArchFrame>
            <div className="flex items-start justify-between gap-1">
              <h3 className="type-body-medium text-ink">Smart watch S9</h3>
              <VerificationSeal level="TRUSTED_VENDOR" size="sm" />
            </div>
            <p className="type-caption text-ink-muted">Gadget Galaxy · 3 shops</p>
            <PriceTicket amount={12900} msrp={14500} className="self-start" />
            <p className="type-caption text-success-ink">In stock</p>
          </article>
        </div>
      </Section>

      <Section title="Arcade (reload to replay)">
        <Arcade className="max-w-3xl" />
      </Section>
    </div>
  );
}