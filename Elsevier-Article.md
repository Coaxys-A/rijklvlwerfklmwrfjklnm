# TekRAG-Persian: A Data-Centric Benchmark for Reducing Hallucination in Persian Technical Question Answering

## Manuscript Type

Research article / benchmark paper

## Target Area

Applied artificial intelligence, information retrieval, natural language processing, low-resource language technologies, retrieval-augmented generation, data quality, and hallucination evaluation.

## Author Information

**Author:** TODO  
**Affiliation:** TODO  
**Corresponding author:** TODO  
**Email:** TODO  
**ORCID:** TODO, if available  

## Highlights

- Introduces a Persian technical question-answering benchmark for retrieval-augmented generation evaluation.
- Compares raw, cleaned, and metadata-enriched corpus variants to isolate the effect of data quality.
- Measures hallucination, citation accuracy, retrieval quality, and answer faithfulness in Persian technical domains.
- Provides a reproducible evaluation protocol for data-centric RAG systems in a low-resource language.
- Shows how provenance and semantic metadata can improve grounding in technical Persian QA.

## Abstract

Retrieval-augmented generation (RAG) has become a common approach for reducing hallucination in large language model applications. However, most RAG evaluations focus on English corpora, general-domain question answering, or model-centric improvements, while the role of corpus quality in low-resource technical domains remains underexplored. This paper introduces **TekRAG-Persian**, a data-centric benchmark for evaluating hallucination and grounding in Persian technical question answering. The benchmark is designed around a curated Persian technology corpus covering artificial intelligence, data governance, cybersecurity, software engineering, hardware, and digital infrastructure. We compare three corpus preparation strategies: a raw corpus with minimal preprocessing, a cleaned corpus with normalized Persian text and section-aware chunking, and a metadata-enriched corpus that adds title, category, tags, author, publication date, summary, canonical source, and provenance information to each retrievable chunk. The evaluation protocol measures retrieval quality, answer correctness, citation accuracy, hallucination rate, unsupported claim count, and operational cost. The study is designed to test whether data quality interventions can improve factual grounding without requiring model fine-tuning. By focusing on Persian technical content, this work contributes a practical benchmark design and a reproducible methodology for evaluating data-centric RAG systems in underrepresented languages.

**Keywords:** Persian NLP; Retrieval-Augmented Generation; RAG; Hallucination; Data Quality; Low-Resource Languages; Technical Question Answering; Information Retrieval; Provenance

## 1. Introduction

Large language models are increasingly used as interfaces for technical knowledge bases, enterprise documentation, research archives, and editorial corpora. Retrieval-augmented generation (RAG) has become one of the most practical ways to improve factual grounding in these systems. Instead of relying only on model parameters, a RAG system retrieves external context and asks the model to answer using the retrieved evidence. In principle, this should reduce hallucination and improve traceability. In practice, RAG systems often fail because the retrieved context is incomplete, noisy, duplicated, poorly chunked, outdated, or weakly described by metadata.

The problem is more visible in low-resource and morphologically complex languages such as Persian. Persian technical content often includes mixed Persian-English terminology, inconsistent spelling, Arabic/Persian character variants, non-standard punctuation, domain-specific abbreviations, and formatting artifacts from web publishing systems. These issues affect tokenization, embedding quality, retrieval precision, and the model's ability to ground an answer. A technically correct article may therefore become a weak retrieval source if it is inserted into a vector database without careful preprocessing.

Most current discussions about hallucination focus on model architecture, prompting, or fine-tuning. These are important, but they can hide a simpler operational reality: many hallucinations in deployed RAG systems are caused by poor data preparation. A model cannot cite what retrieval fails to retrieve. A generator cannot remain grounded if retrieved chunks lack source identity, heading context, publication date, or semantic metadata. For Persian technical question answering, the absence of well-documented benchmarks makes it difficult to measure how much corpus quality matters.

This paper proposes **TekRAG-Persian**, a benchmark and evaluation protocol for studying the effect of data quality on Persian technical RAG systems. The central research question is:

**How do corpus cleaning, semantic metadata enrichment, and provenance-aware chunking affect retrieval accuracy and hallucination rates in Persian technical question answering using RAG?**

The proposed study compares three corpus variants: raw, cleaned, and metadata-enriched. The raw corpus represents a common baseline in which article content is indexed with minimal preprocessing. The cleaned corpus applies Persian text normalization, boilerplate removal, and section-aware chunking. The metadata-enriched corpus adds structured context such as title, category, tags, author, publication date, canonical URL, summary, and provenance fields to each chunk.

This work makes three contributions:

1. It defines a Persian technical QA benchmark design for evaluating RAG systems in technology domains.
2. It introduces a data-centric evaluation protocol that isolates the impact of corpus preparation.
3. It provides a measurement framework for hallucination, citation accuracy, retrieval quality, and answer faithfulness in Persian technical QA.

The paper is intentionally applied. It does not claim to introduce a new language model. Instead, it evaluates whether better data preparation can improve RAG performance in a realistic Persian technical setting.

## 2. Related Work

### 2.1 Retrieval-Augmented Generation

Retrieval-augmented generation combines information retrieval with neural text generation. A retriever selects passages from an external corpus, and a generator produces an answer conditioned on those passages. RAG is widely used for open-domain question answering, enterprise search, customer support, document analysis, and technical assistants. Its appeal comes from three properties: external knowledge can be updated without retraining, generated answers can cite sources, and domain-specific corpora can be used with general-purpose language models.

However, RAG performance depends on each stage of the pipeline. Errors can occur during document parsing, chunking, embedding, retrieval, reranking, prompt assembly, generation, and citation mapping. A failure in any stage may produce an unsupported or misleading answer. This motivates evaluation methods that measure both retrieval and generation quality.

### 2.2 Hallucination in Language Models

Hallucination refers to generated content that is unsupported, false, misleading, or inconsistent with available evidence. In RAG systems, hallucination can appear in several forms:

- the answer includes claims not present in retrieved sources;
- the answer cites the wrong source;
- the answer combines unrelated retrieved facts into a false conclusion;
- the answer ignores retrieved evidence and relies on model priors;
- the answer overgeneralizes beyond the corpus.

A data-centric hallucination study should therefore evaluate not only final answer correctness, but also whether each claim is supported by retrieved context.

### 2.3 Data-Centric AI and Corpus Quality

Data-centric AI emphasizes improving datasets, labels, metadata, and data pipelines rather than only changing model architecture. In RAG systems, data-centric improvements may include text normalization, duplicate removal, source attribution, semantic chunking, metadata enrichment, quality filtering, and provenance tracking. These interventions are especially important when the source corpus contains web content, multilingual terms, HTML artifacts, or inconsistent editorial formats.

### 2.4 Persian NLP and Low-Resource Technical QA

Persian NLP has challenges that differ from English. Persian uses right-to-left script, has Arabic/Persian character variants, includes optional diacritics, uses half-space characters, and often mixes English technical terms with Persian explanation. Technical Persian writing may contain English acronyms such as RAG, LLM, GPU, API, SQL, CVE, and MCP. These mixed-language patterns can affect embedding models, retrieval ranking, and generated answer clarity.

Existing Persian NLP work has addressed tokenization, normalization, sentiment analysis, machine translation, and language modeling. However, Persian technical RAG evaluation remains underdeveloped. A benchmark focused on Persian technology content can help measure practical system behavior in a domain that matters for education, journalism, engineering, and enterprise AI adoption.

## 3. Benchmark Design

### 3.1 Corpus Scope

The proposed corpus contains Persian technical articles covering:

- artificial intelligence;
- data science and data governance;
- cybersecurity;
- software engineering;
- hardware and infrastructure;
- technology strategy and startups.

Each article should include title, subtitle, summary, body text, headings, publication date, author, category, tags, canonical URL, and optional source notes. The corpus should be curated to avoid duplicate pages, incomplete drafts, future-dated unpublished content, and pages without stable canonical URLs.

### 3.2 Document Representation

Each document is converted into a structured representation:

```json
{
  "article_id": "example-id",
  "slug": "example-slug",
  "title": "Persian title",
  "subtitle": "Persian subtitle",
  "summary": "Persian summary",
  "category": "ai",
  "tags": ["RAG", "LLM", "هوش مصنوعی"],
  "author": "Author name",
  "published_at": "YYYY-MM-DD",
  "canonical_url": "https://www.example.com/article/example-slug",
  "sections": [
    {
      "heading": "Section heading",
      "text": "Section body"
    }
  ]
}
```

This representation preserves both content and semantic metadata. It also supports section-aware chunking, which is important for technical articles with hierarchical headings.

### 3.3 Question-Answer Set

The benchmark should include between 200 and 500 Persian questions in its first version. Each question should be manually reviewed and linked to supporting chunks. The question set should include:

- definition questions;
- comparison questions;
- cause-and-effect questions;
- procedural questions;
- risk and mitigation questions;
- trend interpretation questions;
- multi-hop questions requiring multiple sources.

Each question record should include:

```json
{
  "question_id": "q001",
  "question": "Persian question text",
  "topic": "ai",
  "difficulty": "medium",
  "expected_answer": "Reference answer",
  "supporting_chunks": ["chunk-123", "chunk-124"],
  "answer_type": "explanation"
}
```

The expected answer should not be a rigid string match target. It should guide human evaluation and allow semantically equivalent answers.

## 4. Corpus Variants

### 4.1 Raw Corpus

The raw corpus represents a minimal preprocessing baseline. It contains article text extracted with limited cleaning. It may preserve some formatting artifacts, inconsistent spacing, weak heading context, and limited metadata. This baseline simulates a common production shortcut: indexing content quickly without serious data preparation.

### 4.2 Cleaned Corpus

The cleaned corpus applies:

- HTML tag removal;
- boilerplate removal;
- Persian/Arabic character normalization;
- whitespace normalization;
- heading preservation;
- duplicate removal;
- section-aware chunking;
- removal of navigation or unrelated page text.

The purpose is to test whether basic language- and format-aware cleaning improves retrieval and answer quality.

### 4.3 Metadata-Enriched Corpus

The metadata-enriched corpus includes all cleaned text plus structured metadata in each retrievable chunk:

- article title;
- section heading;
- category;
- tags;
- author;
- publication date;
- summary;
- canonical URL;
- provenance identifier.

The goal is to determine whether semantic metadata improves answer grounding and source attribution.

### 4.4 Provenance-Aware Prompting

An optional fourth condition adds provenance-aware prompting. In this setup, the model must answer only from retrieved chunks, cite chunk IDs or URLs, and explicitly say when the provided context is insufficient. This condition tests whether metadata plus prompt constraints reduce unsupported claims.

## 5. Methodology

### 5.1 Retrieval Pipeline

For each corpus variant, the pipeline follows the same steps:

1. parse documents;
2. split documents into chunks;
3. generate embeddings;
4. index chunks in a vector store;
5. retrieve top-k chunks for each question;
6. generate an answer using a fixed prompt;
7. evaluate retrieval and answer quality.

The top-k values should include k=3, k=5, and k=8. This makes it possible to observe whether metadata improves ranking quality or merely adds more useful context when more chunks are retrieved.

### 5.2 Chunking Strategy

The chunking strategy should preserve heading context. Each chunk should include:

- chunk ID;
- article ID;
- heading path;
- text;
- token or word count;
- metadata fields.

Chunk size should be reported clearly. A recommended starting point is 300 to 700 words per chunk. Very small chunks may lose context; very large chunks may reduce retrieval precision and increase token cost.

### 5.3 Generation Prompt

A standard generation prompt should be used across all variants. The prompt should instruct the model to:

- answer in Persian;
- use only retrieved context;
- cite supporting sources;
- avoid unsupported claims;
- state when evidence is insufficient.

Example:

```text
You are answering a Persian technical question using only the provided context.
If the context does not support an answer, say that the available evidence is insufficient.
Do not add claims that are not supported by the context.
Provide concise citations using the supplied source IDs.

Question:
{question}

Context:
{retrieved_chunks}

Answer:
```

The model, temperature, maximum output length, and all generation settings must be fixed and reported.

## 6. Evaluation Metrics

### 6.1 Retrieval Metrics

Retrieval should be evaluated before generation. Recommended metrics:

- Recall@k;
- Precision@k;
- Mean Reciprocal Rank;
- supporting chunk hit rate;
- category match rate.

Supporting chunk hit rate is especially useful. It measures whether at least one gold supporting chunk appears in the retrieved top-k set.

### 6.2 Answer Quality Metrics

Generated answers should be evaluated using:

- correctness;
- completeness;
- faithfulness to retrieved context;
- citation accuracy;
- unsupported claim count;
- hallucination rate.

Citation accuracy should check whether cited chunks actually support the claims they are attached to.

### 6.3 Human Evaluation Rubric

Human evaluators should score answers from 1 to 5:

1. incorrect or hallucinated;
2. partially relevant but mostly unsupported;
3. mostly correct but incomplete or weakly cited;
4. correct, grounded, and mostly complete;
5. correct, complete, concise, and well-cited.

At least two evaluators should review a sample of answers. If possible, inter-annotator agreement should be reported.

### 6.4 Operational Metrics

Operational metrics help evaluate production usefulness:

- latency;
- input token count;
- output token count;
- total token cost;
- refusal rate;
- average answer length.

These metrics matter because a system with slightly better answer quality may be too expensive or slow for practical use.

## 7. Experimental Matrix

The main experiment should compare:

| Condition | Corpus | Prompt | Retrieval |
|---|---|---|---|
| A | Raw | Standard | Vector top-k |
| B | Cleaned | Standard | Vector top-k |
| C | Metadata-enriched | Standard | Vector top-k |
| D | Metadata-enriched | Provenance-aware | Vector top-k |

Optional baselines:

| Condition | Description |
|---|---|
| E | No-RAG model answer |
| F | BM25 keyword retrieval |
| G | Hybrid retrieval |
| H | Metadata-enriched retrieval with reranking |

The no-RAG baseline is valuable because it shows how often the model invents unsupported answers without external context.

## 8. Results

**Important:** This section must not be completed with invented values. The following tables are templates to be filled after running experiments.

### 8.1 Retrieval Results

| Corpus Variant | Recall@3 | Recall@5 | Recall@8 | MRR | Supporting Chunk Hit Rate |
|---|---:|---:|---:|---:|---:|
| Raw | TODO | TODO | TODO | TODO | TODO |
| Cleaned | TODO | TODO | TODO | TODO | TODO |
| Metadata-enriched | TODO | TODO | TODO | TODO | TODO |

### 8.2 Answer Quality Results

| Condition | Correctness | Completeness | Citation Accuracy | Hallucination Rate | Unsupported Claims |
|---|---:|---:|---:|---:|---:|
| Raw RAG | TODO | TODO | TODO | TODO | TODO |
| Cleaned RAG | TODO | TODO | TODO | TODO | TODO |
| Metadata-enriched RAG | TODO | TODO | TODO | TODO | TODO |
| Provenance-aware RAG | TODO | TODO | TODO | TODO | TODO |

### 8.3 Operational Results

| Condition | Avg Latency | Avg Input Tokens | Avg Output Tokens | Refusal Rate |
|---|---:|---:|---:|---:|
| Raw RAG | TODO | TODO | TODO | TODO |
| Cleaned RAG | TODO | TODO | TODO | TODO |
| Metadata-enriched RAG | TODO | TODO | TODO | TODO |
| Provenance-aware RAG | TODO | TODO | TODO | TODO |

## 9. Discussion

The expected outcome is that cleaned and metadata-enriched corpora will improve retrieval quality and reduce unsupported generation compared with the raw corpus. If the hypothesis is confirmed, the results would support a practical conclusion: Persian RAG quality depends not only on model choice but also on data preparation, chunk design, and provenance metadata.

If cleaning improves retrieval but metadata primarily improves citation accuracy, that distinction should be discussed. It would suggest that text normalization and chunking help the retriever find relevant evidence, while metadata helps the generator use evidence responsibly. If provenance-aware prompting increases refusal rate while reducing hallucination, the tradeoff should also be reported.

The discussion should pay special attention to mixed Persian-English terminology. Technical Persian often contains English acronyms and borrowed terms. Preserving these terms during preprocessing may improve retrieval because users often ask questions using either Persian explanations or English technical names. A metadata-enriched chunk can bridge these forms by storing both article tags and section context.

The study should also discuss failures. Multi-hop questions may remain difficult if relevant evidence is spread across multiple articles. Some hallucinations may occur even when correct chunks are retrieved, which would indicate generation-stage weaknesses rather than retrieval-stage failures. Conversely, wrong answers caused by missing gold chunks should be treated as retrieval failures.

## 10. Limitations

This study has several limitations. First, the corpus is domain-specific and focused on technology journalism and technical explanation. Results may not generalize to medical, legal, literary, or conversational Persian. Second, the benchmark size may be modest in its first version. Third, evaluation depends partly on human judgment, especially for hallucination and completeness. Fourth, the choice of embedding model and generator model can affect results. Fifth, if the corpus cannot be fully released because of licensing restrictions, reproducibility may depend on releasing derived metadata, question sets, scripts, or a smaller open subset.

These limitations do not invalidate the study. They define the scope. The paper should present TekRAG-Persian as a practical benchmark and methodology, not as a universal Persian NLP solution.

## 11. Ethics and Data Availability

The corpus should include only content that the authors have the right to process for research. If user-generated comments or personal data are excluded, state that clearly. If author names and publication dates are included, explain that they are public editorial metadata. The study should not include private user data, unpublished drafts, credentials, analytics logs, or personal identifiers beyond public author metadata.

Data availability options:

1. Full public dataset release, if licensing permits.
2. Partial dataset release with article IDs, metadata, questions, expected answers, and chunk references.
3. Script release only, allowing others to reproduce the pipeline on their own corpora.

Code availability should include preprocessing scripts, chunking logic, prompt templates, evaluation scripts, and metric definitions.

If generative AI is used for language editing, the manuscript should disclose it according to the target journal's policy. Generative AI should not be listed as an author.

## 12. Conclusion

This paper proposes TekRAG-Persian, a data-centric benchmark for evaluating hallucination in Persian technical question answering. The proposed study compares raw, cleaned, and metadata-enriched corpora to measure how data preparation affects retrieval quality, citation accuracy, and answer faithfulness. By focusing on Persian technical content, the benchmark addresses an underrepresented language and a practical deployment problem. The central argument is that hallucination reduction in RAG is not only a model problem. It is also a corpus quality, metadata, and provenance problem.

If validated experimentally, the benchmark can help Persian-language AI developers, publishers, educators, and enterprise teams build more reliable RAG systems. It can also provide a reproducible foundation for future research on low-resource technical question answering.

## Declarations

### Funding

TODO: State whether the work received funding. If not, write: "This research received no external funding."

### Conflicts of Interest

TODO: Declare any conflicts. If none, write: "The authors declare no competing interests."

### Data Availability

TODO: State whether the dataset, metadata, scripts, and evaluation files will be publicly available.

### Code Availability

TODO: Provide repository link or state when code will be released.

### Ethics Statement

TODO: Confirm that no private user data, credentials, unpublished drafts, or sensitive analytics logs were used.

### AI-Assisted Writing Disclosure

TODO: Disclose any AI-assisted language editing if used, according to the selected journal's policy.

## Cover Letter Draft

Dear Editor,

We are pleased to submit our manuscript, "TekRAG-Persian: A Data-Centric Benchmark for Reducing Hallucination in Persian Technical Question Answering," for consideration as a research article.

This manuscript addresses a practical and underexplored problem in retrieval-augmented generation: the effect of corpus quality, semantic metadata, and provenance-aware chunking on hallucination in Persian technical question answering. While RAG systems are widely used, evaluation remains heavily centered on English and general-domain datasets. Our work contributes a Persian technical QA benchmark design and a reproducible data-centric evaluation protocol comparing raw, cleaned, and metadata-enriched corpora.

We believe the manuscript is suitable for your journal because it combines applied artificial intelligence, information retrieval, low-resource NLP, and practical evaluation of trustworthy language model systems.

The manuscript is original, has not been published elsewhere, and is not under consideration by another journal. All authors have approved the submission.

Sincerely,

TODO: Author name

## Pre-Submission Checklist

- [ ] Finalize target journal.
- [ ] Read the journal's Guide for Authors.
- [ ] Complete literature review.
- [ ] Build raw, cleaned, and metadata-enriched corpus variants.
- [ ] Create and review Persian QA benchmark.
- [ ] Run retrieval experiments.
- [ ] Run generation experiments.
- [ ] Complete human evaluation.
- [ ] Fill results tables with real values.
- [ ] Add citations in required style.
- [ ] Complete declarations.
- [ ] Run plagiarism/self-plagiarism check.
- [ ] Prepare figures and supplementary material.
- [ ] Submit through journal system.
