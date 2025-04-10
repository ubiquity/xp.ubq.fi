import type { ActivityData, Contributor, Issue, ReviewStatistics } from '../types/data-types';
import { CommentType } from '../types/data-types';

/**
 * Generate mock activity data for development and testing
 */
export function generateMockData(count = 20): ActivityData[] {
  const mockData: ActivityData[] = [];

  // Generate a set of mock repositories
  const repositories = ['frontend-app', 'backend-api', 'documentation', 'design-system', 'core-lib'];

  // Generate a set of mock contributors
  const contributors: Contributor[] = [
    { login: 'alice', name: 'Alice Smith', avatarUrl: 'https://example.com/avatar1.png', contributions: 127 },
    { login: 'bob', name: 'Bob Johnson', avatarUrl: 'https://example.com/avatar2.png', contributions: 84 },
    { login: 'carol', name: 'Carol Williams', avatarUrl: 'https://example.com/avatar3.png', contributions: 215 },
    { login: 'dave', name: 'Dave Brown', avatarUrl: 'https://example.com/avatar4.png', contributions: 63 },
    { login: 'eve', name: 'Eve Davis', avatarUrl: 'https://example.com/avatar5.png', contributions: 192 },
  ];

  // Generate mock comment types
  const commentTypes: CommentType[] = [
    CommentType.ISSUE_SPECIFICATION,
    CommentType.ISSUE_AUTHOR,
    CommentType.ISSUE_ASSIGNEE,
    CommentType.PULL_AUTHOR,
    CommentType.PULL_ASSIGNEE,
    CommentType.PULL_REVIEWER,
    CommentType.OTHER
  ];

  // Generate mock review states
  const reviewStates = ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING'];

  // Create activity data entries
  for (let i = 0; i < count; i++) {
    // Create a mock issue
    const isPullRequest = Math.random() > 0.5;
    const repositoryIndex = Math.floor(Math.random() * repositories.length);
    const repository = repositories[repositoryIndex];
    const issueNumber = Math.floor(Math.random() * 1000) + 1;

    // Random date in the last 90 days
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)).toISOString();

    // 70% of issues are closed
    const isClosed = Math.random() > 0.3;
    let closedAt: string | undefined;
    if (isClosed) {
      // Closed 1-30 days after creation
      const createdDate = new Date(createdAt);
      const closedDate = new Date(createdDate.getTime() + Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
      closedAt = closedDate.toISOString();
    }

    // Generate 0-5 labels
    const labelCount = Math.floor(Math.random() * 6);
    const labels: string[] = [];
    const possibleLabels = ['bug', 'enhancement', 'documentation', 'question', 'feature', 'help wanted', 'good first issue'];
    for (let j = 0; j < labelCount; j++) {
      const labelIndex = Math.floor(Math.random() * possibleLabels.length);
      if (!labels.includes(possibleLabels[labelIndex])) {
        labels.push(possibleLabels[labelIndex]);
      }
    }

    // Create the issue
    const issue: Issue = {
      id: i + 1000,
      number: issueNumber,
      title: `${isPullRequest ? 'PR' : 'Issue'} #${issueNumber}: ${generateRandomTitle(isPullRequest)}`,
      state: isClosed ? 'closed' : 'open',
      createdAt,
      closedAt,
      author: contributors[Math.floor(Math.random() * contributors.length)].login,
      assignees: generateRandomAssignees(contributors),
      labels,
      repository,
      isPullRequest
    };

    // Generate 1-10 comments
    const commentCount = Math.floor(Math.random() * 10) + 1;
    const comments = [];

    for (let j = 0; j < commentCount; j++) {
      const commentTypeIndex = Math.floor(Math.random() * commentTypes.length);
      const commentType = commentTypes[commentTypeIndex];
      const commentAuthor = contributors[Math.floor(Math.random() * contributors.length)].login;

      // Comments are added between creation and closing (or now if still open)
      const createdDate = new Date(createdAt);
      const endDate = isClosed ? new Date(closedAt!) : new Date();
      const commentDate = new Date(createdDate.getTime() + Math.random() * (endDate.getTime() - createdDate.getTime()));
      const commentCreatedAt = commentDate.toISOString();

      // Sometimes comments are updated
      const isUpdated = Math.random() > 0.7;
      const commentUpdatedAt = isUpdated
        ? new Date(commentDate.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000)).toISOString()
        : commentCreatedAt;

      // Generate comment quality metrics
      const wordCount = Math.floor(Math.random() * 300) + 20;
      const readabilityScore = Math.random() * 100;
      const relevanceScore = Math.random() * 100;
      const formattingScore = Math.random() * 100;

      // Generate HTML entities
      const codeSnippets = Math.floor(Math.random() * 3);
      const images = Math.floor(Math.random() * 2);
      const links = Math.floor(Math.random() * 5);

      comments.push({
        id: (i + 1000) * 100 + j,
        issueId: i + 1000,
        author: commentAuthor,
        createdAt: commentCreatedAt,
        updatedAt: commentUpdatedAt,
        type: commentType,
        content: generateRandomComment(wordCount, commentType),
        quality: {
          wordCount,
          readabilityScore,
          relevanceScore,
          formattingScore
        },
        htmlEntities: {
          codeSnippets,
          images,
          links
        }
      });
    }

    // Generate reviews if it's a pull request
    let reviews: ReviewStatistics[] = [];
    if (isPullRequest) {
      const reviewCount = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < reviewCount; j++) {
        const reviewerIndex = Math.floor(Math.random() * contributors.length);
        const reviewer = contributors[reviewerIndex].login;

        // Don't assign the author as a reviewer
        if (reviewer !== issue.author) {
          const linesReviewed = Math.floor(Math.random() * 500) + 10;
          const reviewStateIndex = Math.floor(Math.random() * reviewStates.length);
          const reviewState = reviewStates[reviewStateIndex] as any;
          const timeToReview = Math.floor(Math.random() * 1440) + 10; // 10 minutes to 24 hours
          const commentCount = Math.floor(Math.random() * 10);

          reviews.push({
            linesReviewed,
            reviewState,
            timeToReview,
            commentCount
          });
        }
      }
    }

    // Generate events
    const eventCount = Math.floor(Math.random() * 5) + 2;
    const events = [];

    // Always add a created event
    events.push({
      type: 'created',
      createdAt: createdAt,
      actor: issue.author
    });

    // Add labeled, assigned, etc. events
    const eventTypes = ['labeled', 'assigned', 'commented', 'referenced', 'mentioned'];
    for (let j = 0; j < eventCount; j++) {
      const eventTypeIndex = Math.floor(Math.random() * eventTypes.length);
      const eventType = eventTypes[eventTypeIndex];
      const eventActorIndex = Math.floor(Math.random() * contributors.length);
      const eventActor = contributors[eventActorIndex].login;

      // Events happen between creation and closing (or now if still open)
      const createdDate = new Date(createdAt);
      const endDate = isClosed ? new Date(closedAt!) : new Date();
      const eventDate = new Date(createdDate.getTime() + Math.random() * (endDate.getTime() - createdDate.getTime()));
      const eventCreatedAt = eventDate.toISOString();

      events.push({
        type: eventType,
        createdAt: eventCreatedAt,
        actor: eventActor,
        detail: generateRandomEventDetail(eventType)
      });
    }

    // Add closed event if the issue is closed
    if (isClosed && closedAt) {
      events.push({
        type: 'closed',
        createdAt: closedAt,
        actor: issue.assignees.length > 0
          ? issue.assignees[Math.floor(Math.random() * issue.assignees.length)]
          : issue.author
      });
    }

    // Sort events by date
    events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Create activity data
    mockData.push({
      issue,
      comments,
      reviews,
      events,
      contributors: contributors.filter(() => Math.random() > 0.3), // Randomly include contributors
      timestamp: new Date().toISOString()
    });
  }

  return mockData;
}

// Helper functions for generating random content

function generateRandomTitle(isPullRequest: boolean): string {
  const actions = isPullRequest
    ? ['Add', 'Update', 'Fix', 'Refactor', 'Improve', 'Implement', 'Remove']
    : ['Bug in', 'Problem with', 'Question about', 'Feedback on', 'Enhancement for'];

  const components = [
    'user authentication',
    'dashboard layout',
    'data visualization',
    'API endpoints',
    'performance optimization',
    'mobile responsiveness',
    'error handling',
    'documentation',
    'test coverage',
    'accessibility features'
  ];

  const actionIndex = Math.floor(Math.random() * actions.length);
  const componentIndex = Math.floor(Math.random() * components.length);

  return `${actions[actionIndex]} ${components[componentIndex]}`;
}

function generateRandomAssignees(contributors: Contributor[]): string[] {
  const assigneeCount = Math.floor(Math.random() * 3);
  const assignees: string[] = [];

  for (let i = 0; i < assigneeCount; i++) {
    const contributorIndex = Math.floor(Math.random() * contributors.length);
    const assignee = contributors[contributorIndex].login;

    if (!assignees.includes(assignee)) {
      assignees.push(assignee);
    }
  }

  return assignees;
}

function generateRandomComment(wordCount: number, commentType: CommentType): string {
  const sentences = [
    "I think we should consider a different approach here.",
    "Great work on this implementation!",
    "Can you explain the reasoning behind this change?",
    "This looks good to me, ready to merge.",
    "There might be a performance issue with this solution.",
    "Have you considered the edge cases?",
    "The documentation needs to be updated for this change.",
    "I tested this locally and it works as expected.",
    "This should fix the bug reported in the issue.",
    "Let's schedule a call to discuss this further."
  ];

  let commentText = '';

  // Add a prefix based on comment type
  switch (commentType) {
    case CommentType.ISSUE_SPECIFICATION:
      commentText += "**Issue Specification**: ";
      break;
    case CommentType.PULL_REVIEWER:
      commentText += "**Review**: ";
      break;
    case CommentType.PULL_AUTHOR:
      commentText += "**Author's Note**: ";
      break;
    default:
      break;
  }

  // Generate comment content to roughly match the word count
  const neededSentences = Math.ceil(wordCount / 10); // Assume ~10 words per sentence

  for (let i = 0; i < neededSentences; i++) {
    const sentenceIndex = Math.floor(Math.random() * sentences.length);
    commentText += sentences[sentenceIndex] + " ";
  }

  return commentText.trim();
}

function generateRandomEventDetail(eventType: string): string | undefined {
  switch (eventType) {
    case 'labeled':
      const labels = ['bug', 'enhancement', 'documentation', 'question', 'feature', 'help wanted'];
      return labels[Math.floor(Math.random() * labels.length)];
    case 'assigned':
      return undefined; // No detail needed
    case 'referenced':
      return `#${Math.floor(Math.random() * 100) + 1}`;
    default:
      return undefined;
  }
}
