const SITE = "https://cbcnotebooks.co.ke";

export type JsonLdNode = Record<string, unknown>;

export function learningResourceSchema(input: {
  name: string;
  description: string;
  url: string;
  grade: string;
  subject: string;
  learningResourceType: "notes" | "exam paper" | "marking scheme";
  encodingFormat?: string;
}): JsonLdNode {
  return {
    "@type": "LearningResource",
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: ["en", "sw"],
    educationalLevel: input.grade,
    learningResourceType: input.learningResourceType,
    encodingFormat: input.encodingFormat || "application/pdf",
    isAccessibleForFree: true,
    countryOfOrigin: { "@type": "Country", name: "Kenya" },
    about: {
      "@type": "Thing",
      name: `${input.subject} · Kenya CBC`,
    },
    audience: {
      "@type": "EducationalAudience",
      educationalRole: ["student", "teacher", "parent"],
    },
    provider: {
      "@type": "Organization",
      name: "CBC Notebooks",
      url: SITE,
    },
  };
}

export function courseSchema(input: {
  name: string;
  description: string;
  url: string;
  grade: number;
  subject: string;
}): JsonLdNode {
  return {
    "@type": "Course",
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: ["en", "sw"],
    educationalLevel: `Grade ${input.grade}`,
    isAccessibleForFree: true,
    provider: {
      "@type": "Organization",
      name: "CBC Notebooks",
      url: SITE,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      inLanguage: ["en", "sw"],
    },
    about: {
      "@type": "Thing",
      name: input.subject,
    },
    educationalCredentialAwarded: input.grade <= 6 ? "KPSEA preparation" : input.grade <= 9 ? "KJSEA preparation" : "KSSEA / Senior School pathway",
  };
}

export function videoObjectSchema(input: {
  name: string;
  description: string;
  url: string;
  thumbnailUrl?: string;
  duration?: string;
  uploadDate?: string;
}): JsonLdNode {
  return {
    "@type": "VideoObject",
    name: input.name,
    description: input.description,
    url: input.url,
    contentUrl: input.url,
    thumbnailUrl: input.thumbnailUrl || `${SITE}/assets/img/icons/icon-512.png`,
    duration: input.duration || "PT8M",
    uploadDate: input.uploadDate || "2026-01-15",
    inLanguage: "en",
    isFamilyFriendly: true,
    publisher: {
      "@type": "Organization",
      name: "CBC Notebooks",
      logo: `${SITE}/assets/img/icons/icon-512.png`,
    },
  };
}

export function cbcJsonLdGraph(): JsonLdNode[] {
  const org: JsonLdNode = {
    "@type": "Organization",
    "@id": `${SITE}/#org`,
    name: "CBC Notebooks",
    url: SITE,
    logo: `${SITE}/assets/img/icons/icon-512.png`,
    areaServed: "KE",
  };

  const courses = [4, 5, 6, 7, 8, 9, 10].map((grade) =>
    courseSchema({
      name: `Grade ${grade} CBC subject pathway`,
      description: `Kenya Competency-Based Curriculum pathway for Grade ${grade}, covering notes, exams, videos, experiments, audiobooks and immersive learning.`,
      url: `${SITE}/notes/grade-${grade}/`,
      grade,
      subject: grade <= 6 ? "Upper Primary" : grade <= 9 ? "Junior Secondary" : "Senior School",
    })
  );

  const resources = [
    learningResourceSchema({
      name: "Grade 6 Mathematics CBC notes",
      description: "Downloadable PDF notes and strands for Grade 6 Mathematics aligned to KICD CBC.",
      url: `${SITE}/notes/grade-6/mathematics/`,
      grade: "Grade 6",
      subject: "Mathematics",
      learningResourceType: "notes",
    }),
    learningResourceSchema({
      name: "Grade 9 Integrated Science KPSEA/KJSEA exam paper",
      description: "Past paper, marking scheme and scheme of work for Junior Secondary Integrated Science.",
      url: `${SITE}/exams/grade-9/term-2/`,
      grade: "Grade 9",
      subject: "Integrated Science",
      learningResourceType: "exam paper",
    }),
  ];

  const videos = [
    videoObjectSchema({
      name: "Grade 7 Integrated Science circuit experiment",
      description: "Practical science video for simple circuits in the CBC Junior Secondary laboratory.",
      url: `${SITE}/videos/grade-7/integrated-science/circuits/`,
    }),
    videoObjectSchema({
      name: "Grade 8 Pre-Technical workshop tools",
      description: "Pre-technical studies video covering workshop tools, safety and simple machines.",
      url: `${SITE}/videos/grade-8/pre-technical-studies/workshop-tools/`,
    }),
  ];

  return [org, ...courses, ...resources, ...videos];
}

export function JsonLd({ data }: { data?: JsonLdNode | JsonLdNode[] }) {
  const graph = data ? (Array.isArray(data) ? data : [data]) : cbcJsonLdGraph();
  const payload = {
    "@context": "https://schema.org",
    "@graph": graph,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
