# Elsevier Publication Plan for Teknav

## Target Direction

The recommended English article path for Teknav is not a translated blog post and not a broad trend essay. The strongest and most realistic scope is an applied research manuscript about Persian technical retrieval-augmented generation, data quality, and hallucination reduction.

Recommended working title:

**TekRAG-Persian: A Data-Centric Benchmark for Reducing Hallucination in Persian Technical Question Answering**

Alternative title:

**Evaluating Data Quality Effects on Hallucination in Persian Technical Retrieval-Augmented Generation Systems**

This direction fits Teknav because the site already has a strong Persian technical corpus, an editorial focus on AI/data quality, and proven topical authority around data-centric AI. It also fits academic indexing better than a general “AI trends” article because it can become a measurable study with a dataset, method, evaluation protocol, results, and limitations.

## Important Reality Check

To appear in Elsevier or Scopus, the work must be accepted by a scholarly venue. A normal website article published on Teknav will not appear in Elsevier automatically. Elsevier journals publish peer-reviewed manuscripts, and Scopus indexes selected journals, book series, conference series, books, and other scholarly sources. The goal is therefore to prepare a manuscript that can survive editor screening and peer review.

Elsevier’s own author guidance emphasizes preparing research for publication and submitting through a suitable journal workflow. Scopus selection guidance emphasizes peer-reviewed content, academic contribution, English titles and abstracts, publication ethics, journal quality, and international readability. This plan is built around those expectations.

Official references:

- Elsevier publishing guide: https://www.elsevier.com/publishing/publish-in-a-journal
- Scopus content selection policy: https://www.elsevier.com/products/scopus/content/content-policy-and-selection

## Why This Topic Is the Best Fit

Teknav’s strongest existing content advantage is Persian technical writing about AI, data governance, model reliability, RAG, agents, and software systems. The article `ai-data-centric-2026` performed well because it connected a Persian explanation with English technical entities such as Model Collapse, Data Provenance, Semantic Layers, and Data-Centric AI. That same pattern can be converted into a research paper, but the paper must go beyond explanation. It must test something.

The easiest publishable academic niche is:

**How data cleaning, metadata enrichment, and source provenance affect hallucination and answer quality in Persian technical RAG systems.**

This is practical, measurable, and not too compute-heavy. It also has novelty because Persian technical QA is a lower-resource area compared with English benchmarks. The research does not need to invent a new model. It can contribute a benchmark, dataset construction method, evaluation protocol, and empirical findings.

## Core Research Question

The main research question should be:

**How do corpus cleaning, semantic metadata enrichment, and provenance-aware chunking affect retrieval accuracy and hallucination rates in Persian technical question answering using RAG?**

Supporting questions:

1. Does cleaning Persian technical HTML into normalized article text improve retrieval precision?
2. Does adding metadata such as title, category, tags, author, publication date, and summary improve answer grounding?
3. Does provenance-aware prompting reduce unsupported claims?
4. Are improvements consistent across AI, cybersecurity, software, hardware, and data science topics?
5. What tradeoffs appear in latency, token cost, answer length, and citation accuracy?

## Proposed Contribution

The paper should claim three concrete contributions:

1. **A Persian technical QA benchmark** built from a curated Persian technology corpus.
2. **A data-centric RAG evaluation protocol** comparing raw, cleaned, and metadata-enriched corpora.
3. **Empirical evidence** showing how data quality interventions affect hallucination, citation accuracy, and retrieval performance in Persian technical QA.

These contributions are modest enough to execute but real enough to be academically evaluated.

## Dataset Design

The dataset should be called something like `TekRAG-Persian` or `Teknav-Persian-TechQA`.

The corpus can be built from Teknav-style articles, but it must be documented carefully. If the articles are proprietary, state whether the dataset itself is released, partially released, or only the evaluation protocol is released. If public release is possible, that strengthens the paper significantly.

Minimum corpus fields:

- article ID
- title
- subtitle
- canonical URL
- category
- tags
- author
- publication date
- summary
- body text
- headings
- source/provenance metadata
- chunk ID
- chunk text
- chunk heading path

Recommended topic categories:

- artificial intelligence
- data science and data governance
- cybersecurity
- software engineering
- hardware and infrastructure
- startups/technology strategy

For the first submission, the dataset does not need to be enormous. A clean, well-documented dataset with 200 to 500 question-answer pairs can be more convincing than a noisy large dataset.

## Dataset Versions to Compare

The experimental design should compare at least three corpus variants.

### Variant A: Raw Corpus

This version contains minimally processed article text. It may include HTML remnants, inconsistent headings, duplicated captions, weaker chunk boundaries, and limited metadata.

Purpose:

This simulates the common real-world mistake of dumping content into a vector database without serious data preparation.

### Variant B: Cleaned Corpus

This version normalizes text and structure:

- remove HTML tags
- normalize Persian/Arabic characters
- remove duplicate whitespace
- normalize punctuation where needed
- preserve headings
- remove navigation or boilerplate text
- chunk by section, not arbitrary character count

Purpose:

This tests whether basic Persian content hygiene improves retrieval and answer quality.

### Variant C: Metadata-Enriched Corpus

This version includes cleaned text plus structured metadata:

- title
- category
- tags
- date
- author
- summary
- canonical source
- heading path
- provenance label

Purpose:

This tests whether semantic and provenance metadata improves grounding and reduces hallucination.

Optional Variant D:

Provenance-aware generation prompt, where the model must cite chunk IDs and refuse unsupported claims.

## Question-Answer Dataset

Create question-answer pairs manually or semi-manually, but final validation should be human-reviewed. Each question should have:

- question text in Persian
- topic category
- expected answer
- supporting article/chunk IDs
- difficulty level
- answer type
- whether the answer requires one source or multiple sources

Question types:

- definition questions
- comparison questions
- cause/effect questions
- procedure questions
- risk/mitigation questions
- trend interpretation questions
- multi-hop questions requiring two sections or two articles

Example question:

**Question:** چرا داده‌های مصنوعی بدون نظارت می‌توانند باعث فروپاشی مدل شوند؟

Expected answer should cite concepts such as lower entropy, distribution drift, loss of tail events, and recursive training on model-generated data.

## Experimental Setup

The experiment should be reproducible. Keep it simple.

Pipeline:

1. Build corpus variants A, B, and C.
2. Split articles into chunks.
3. Generate embeddings.
4. Store chunks in a vector index.
5. Retrieve top-k chunks for each question.
6. Generate answer using a fixed prompt.
7. Evaluate retrieval and generation.

Suggested top-k values:

- k = 3
- k = 5
- k = 8

Suggested chunk sizes:

- heading-based chunks
- 300 to 700 words per chunk
- overlap only if necessary

The paper should clearly report the embedding model, vector database or index method, reranker if used, generator model, prompt template, temperature, and hardware/environment.

## Evaluation Metrics

Use both automatic and human evaluation.

Retrieval metrics:

- Recall@k
- Precision@k
- Mean Reciprocal Rank
- supporting chunk hit rate

Answer metrics:

- answer correctness
- citation accuracy
- hallucination rate
- unsupported claim count
- completeness
- faithfulness to retrieved context

Operational metrics:

- average token usage
- latency
- answer length
- refusal rate for unsupported questions

Human evaluation rubric:

Score each answer from 1 to 5:

1. incorrect or hallucinated
2. partially relevant but unsupported
3. mostly correct with missing detail
4. correct and grounded
5. correct, complete, well-cited, and concise

At least two evaluators should review a subset. If possible, report inter-annotator agreement.

## Baselines

The minimum baselines:

1. Raw corpus RAG
2. Cleaned corpus RAG
3. Metadata-enriched corpus RAG

Optional stronger baselines:

4. Keyword/BM25 retrieval only
5. Hybrid retrieval
6. Metadata-enriched retrieval plus reranking
7. No-RAG model answer

The no-RAG baseline is useful because it shows how much unsupported generation happens when the model relies on pretraining alone.

## Expected Hypothesis

The expected hypothesis should be stated before running experiments:

**Metadata-enriched and provenance-aware corpus preparation will reduce hallucination and improve citation accuracy compared with raw RAG over Persian technical content.**

Expected results:

- cleaned corpus improves retrieval over raw corpus
- metadata-enriched corpus improves grounding
- provenance-aware prompt reduces hallucination
- multi-hop questions remain the hardest
- Persian technical terms with English equivalents benefit from metadata and heading preservation

Do not overclaim. If improvements are small, report them honestly.

## Manuscript Structure

Use this structure:

### Title

TekRAG-Persian: A Data-Centric Benchmark for Reducing Hallucination in Persian Technical Question Answering

### Abstract

150 to 250 words:

- problem
- gap
- method
- dataset
- experiment
- key results
- contribution

### Keywords

Persian NLP; Retrieval-Augmented Generation; Hallucination; Data Quality; Low-Resource Languages; Technical Question Answering

### 1. Introduction

Explain why RAG is widely used, why Persian technical QA is underrepresented, and why data quality matters. End with contributions.

### 2. Related Work

Cover:

- RAG
- hallucination evaluation
- data-centric AI
- low-resource NLP
- Persian NLP
- technical QA benchmarks

### 3. Dataset Construction

Describe corpus sources, preprocessing, metadata, QA creation, annotation, and statistics.

### 4. Method

Describe retrieval, chunking, embeddings, prompts, models, and experimental variants.

### 5. Evaluation

Define metrics and human evaluation rubric.

### 6. Results

Tables comparing raw vs cleaned vs enriched corpora.

### 7. Discussion

Explain why results happened, where metadata helped, where it failed, and what this means for Persian technical RAG.

### 8. Limitations

Be direct:

- corpus may be domain-specific
- questions may not cover all Persian styles
- model choice affects results
- human evaluation scale is limited
- dataset release may be partial if licensing restricts full text

### 9. Conclusion

Summarize the contribution and future work.

### Declarations

Include:

- data availability
- code availability
- conflict of interest
- funding
- ethics statement
- AI-assisted writing disclosure if applicable

## Journal Targeting Strategy

Do not aim first for the highest-impact AI journal. The paper is applied and benchmark-oriented. Look for journals that accept work in information systems, applied AI, NLP resources, or data-centric systems.

Possible Elsevier-aligned areas:

- information processing
- computer science applications
- data and knowledge engineering
- artificial intelligence applications
- language resources and evaluation-adjacent venues, even if not Elsevier

Use Elsevier Journal Finder after writing the abstract and keywords. The abstract must be academic, not promotional.

Selection criteria for a target journal:

- accepts applied NLP or information retrieval papers
- has published RAG, QA, benchmark, or low-resource NLP papers
- allows dataset/evaluation papers
- reasonable review timeline
- not too broad
- not predatory or suspicious
- indexed in Scopus if Scopus visibility is required

## Minimum Work Plan

### Week 1: Scope and Literature

- finalize research question
- collect 30 to 50 relevant papers
- define contribution
- choose dataset size
- draft related work outline

### Week 2: Dataset

- export article corpus
- clean text
- create chunking pipeline
- create metadata-enriched corpus
- write dataset documentation

### Week 3: QA and Annotation

- create 200 to 500 Persian questions
- map each question to supporting chunks
- write expected answers
- review quality manually

### Week 4: RAG Pipeline

- implement embeddings
- implement vector search
- implement prompt templates
- run raw, cleaned, enriched variants

### Week 5: Evaluation

- calculate retrieval metrics
- run human evaluation
- measure hallucination/citation accuracy
- create tables and charts

### Week 6: Manuscript Draft

- write methods and dataset sections first
- write results
- write introduction and abstract last
- prepare figures and appendices

### Week 7: Internal Review

- check reproducibility
- check citations
- check English clarity
- check ethics/declarations
- choose target journal

### Week 8: Submission

- adapt formatting to journal guide
- write cover letter
- submit manuscript
- prepare response plan for reviewers

## What Not To Do

Do not submit a Teknav article as-is. It will look like journalism, not research.

Do not make claims like “first ever” unless verified through literature review.

Do not rely only on SEO success as evidence. Google ranking is irrelevant for journal peer review.

Do not overuse generative AI for writing without disclosure. Elsevier and many journals require transparency about AI-assisted writing.

Do not fabricate affiliations, reviewer suggestions, data availability, or experimental results.

Do not hide limitations. Reviewers trust honest limitations more than exaggerated claims.

## Success Criteria Before Submission

The paper is ready when:

- the research question is narrow and testable
- the dataset is documented
- the method can be reproduced
- baseline comparisons are included
- results are presented with tables
- hallucination is measured with a clear rubric
- references are current and peer-reviewed
- the manuscript is written in academic English
- all declarations are complete
- the journal scope clearly matches the paper

## Recommended Final Positioning

Position the paper as a data-centric, low-resource-language RAG evaluation study. The strongest framing is:

**Persian technical RAG systems fail less because of model weakness and more because of corpus quality, metadata, and provenance. This paper measures that effect and provides a benchmark for future work.**

That is a clean academic contribution. It is narrow, testable, connected to Teknav’s strengths, and realistic for an Elsevier or Scopus-indexed publication path.
