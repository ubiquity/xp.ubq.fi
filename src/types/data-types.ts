// Types for the GitHub activity data from text-conversation-rewards module

// Comment types from the text-conversation-rewards module
export enum CommentType {
  ISSUE_SPECIFICATION = 'ISSUE_SPECIFICATION',
  ISSUE_AUTHOR = 'ISSUE_AUTHOR',
  ISSUE_ASSIGNEE = 'ISSUE_ASSIGNEE',
  PULL_AUTHOR = 'PULL_AUTHOR',
  PULL_ASSIGNEE = 'PULL_ASSIGNEE',
  PULL_REVIEWER = 'PULL_REVIEWER',
  OTHER = 'OTHER',
}

// Quality metrics for comments and contributions
export interface QualityMetrics {
  wordCount: number;
  readabilityScore: number; // Score based on readability algorithms
  relevanceScore: number; // How relevant the comment is to the issue/PR
  formattingScore: number; // Score based on proper formatting
}

// Review statistics
export interface ReviewStatistics {
  linesReviewed: number;
  reviewState: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  timeToReview: number; // Time in minutes
  commentCount: number;
}

// HTML entity types that might be in comments
export interface HtmlEntities {
  codeSnippets: number;
  images: number;
  links: number;
}

// GitHub events related to the conversation
export interface GitHubEvent {
  type: string;
  createdAt: string;
  actor: string;
  detail?: string;
}

// Contributor data for aggregation
export interface Contributor {
  login: string;
  name?: string;
  avatarUrl?: string;
  contributions: number;
}

// Issue or Pull Request data
export interface Issue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  createdAt: string;
  closedAt?: string;
  author: string;
  assignees: string[];
  labels: string[];
  repository: string;
  isPullRequest: boolean;
}

// Comment data from the text-conversation-rewards module
export interface CommentData {
  id: number;
  issueId: number;
  author: string;
  createdAt: string;
  updatedAt: string;
  type: CommentType;
  content: string;
  quality: QualityMetrics;
  htmlEntities: HtmlEntities;
}

// The main activity data that combines all elements
export interface ActivityData {
  issue: Issue;
  comments: CommentData[];
  reviews?: ReviewStatistics[];
  events: GitHubEvent[];
  contributors: Contributor[];
  timestamp: string;
}

// Data dimension categories for visualization mapping
export enum DataDimensionCategory {
  COMMENT_TYPE = 'COMMENT_TYPE',
  QUALITY_METRIC = 'QUALITY_METRIC',
  REVIEW_STATISTIC = 'REVIEW_STATISTIC',
  HTML_ENTITY = 'HTML_ENTITY',
  GITHUB_EVENT = 'GITHUB_EVENT',
  TIME = 'TIME',
  CONTRIBUTOR = 'CONTRIBUTOR',
  REPOSITORY = 'REPOSITORY',
  LABEL = 'LABEL',
}

// Data dimension for the chart configuration engine
export interface DataDimension {
  id: string;
  name: string;
  category: DataDimensionCategory;
  accessor: string; // Path to access the data (e.g., "comments.quality.wordCount")
  dataType: 'categorical' | 'numerical' | 'temporal';
  aggregation?: 'sum' | 'average' | 'count' | 'min' | 'max';
}
