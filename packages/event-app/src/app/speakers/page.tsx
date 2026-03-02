"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { SpeakerCarousel } from "@/components/speakers/SpeakerCarousel";

export default function SpeakersPage() {
  return (
    <>
      <PageHeader
        title="Speakers"
        subtitle="Meet the leaders shaping this year's offsite"
      />
      <SpeakerCarousel />
    </>
  );
}
