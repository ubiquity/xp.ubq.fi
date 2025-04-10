import type { ActivityData } from '../types/data-types';
import { generateMockData } from './mock-data-provider';
import { isUsingMockData, supabase } from './supabase-client';

// Default parameters for data fetching
const DEFAULT_LIMIT = 50;
const DEFAULT_PAGE = 1;

export interface FetchParams {
  limit?: number;
  page?: number;
  repositoryFilter?: string[];
  contributorFilter?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Fetch activity data from Supabase
 */
export async function fetchActivityData(params: FetchParams = {}): Promise<ActivityData[]> {
  // Use mock data if we're in mock mode
  if (isUsingMockData) {
    console.log('Using mock activity data');
    return generateMockData(params.limit || DEFAULT_LIMIT);
  }

  try {
    const {
      limit = DEFAULT_LIMIT,
      page = DEFAULT_PAGE,
      repositoryFilter,
      contributorFilter,
      dateFrom,
      dateTo,
    } = params;

    // Calculate offset based on page and limit
    const offset = (page - 1) * limit;

    // Start query builder
    let query = supabase
      .from('activity_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Apply filters if provided
    if (repositoryFilter && repositoryFilter.length > 0) {
      query = query.in('issue.repository', repositoryFilter);
    }

    if (contributorFilter && contributorFilter.length > 0) {
      // This filter is more complex as contributors can be in different roles
      // Using a contains operator, assuming Supabase has JSONB support
      query = query.or(
        contributorFilter.map(contributor => `contributors.cs.{login:"${contributor}"}`).join(',')
      );
    }

    if (dateFrom) {
      query = query.gte('timestamp', dateFrom.toISOString());
    }

    if (dateTo) {
      query = query.lte('timestamp', dateTo.toISOString());
    }

    // Execute the query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching activity data:', error);
      throw new Error(`Failed to fetch activity data: ${error.message}`);
    }

    // Parse the data and return
    return parseActivityData(data);
  } catch (error) {
    console.error('Error fetching activity data, using mock data as fallback:', error);
    return generateMockData(params.limit || DEFAULT_LIMIT);
  }
}

/**
 * Transform raw data from Supabase into our ActivityData type
 */
function parseActivityData(rawData: any[]): ActivityData[] {
  if (!rawData || !Array.isArray(rawData)) {
    return [];
  }

  try {
    return rawData.map(item => ({
      issue: item.issue,
      comments: item.comments || [],
      reviews: item.reviews || [],
      events: item.events || [],
      contributors: item.contributors || [],
      timestamp: item.timestamp,
    }));
  } catch (error) {
    console.error('Error parsing activity data:', error);
    return [];
  }
}

/**
 * Fetch available repositories for filtering
 */
export async function fetchRepositories(): Promise<string[]> {
  // Use mock data if we're in mock mode
  if (isUsingMockData) {
    const mockData = generateMockData(50);
    const repositorySet = new Set<string>();

    mockData.forEach(item => {
      if (item.issue && item.issue.repository) {
        repositorySet.add(item.issue.repository);
      }
    });

    return Array.from(repositorySet);
  }

  try {
    const { data, error } = await supabase
      .from('activity_data')
      .select('issue->repository')
      .limit(1000); // Using limit instead of distinct, will filter unique values in JS

    if (error) {
      console.error('Error fetching repositories:', error);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    // Extract unique repositories
    const repositorySet = new Set<string>();
    data.forEach((item: any) => {
      if (item.issue && item.issue.repository) {
        repositorySet.add(item.issue.repository);
      }
    });

    return Array.from(repositorySet);
  } catch (error) {
    console.error('Error fetching repositories, using mock data as fallback:', error);
    const mockData = generateMockData(50);
    const repositorySet = new Set<string>();

    mockData.forEach(item => {
      if (item.issue && item.issue.repository) {
        repositorySet.add(item.issue.repository);
      }
    });

    return Array.from(repositorySet);
  }
}

/**
 * Fetch available contributors for filtering
 */
export async function fetchContributors(): Promise<string[]> {
  // Use mock data if we're in mock mode
  if (isUsingMockData) {
    const mockData = generateMockData(50);
    const contributorSet = new Set<string>();

    mockData.forEach(item => {
      if (item.contributors && Array.isArray(item.contributors)) {
        item.contributors.forEach(contributor => {
          if (contributor.login) {
            contributorSet.add(contributor.login);
          }
        });
      }
    });

    return Array.from(contributorSet);
  }

  try {
    const { data, error } = await supabase
      .from('activity_data')
      .select('contributors');

    if (error) {
      console.error('Error fetching contributors:', error);
      return [];
    }

    // Extract unique contributor logins
    const contributorSet = new Set<string>();
    data.forEach((item: any) => {
      if (item.contributors && Array.isArray(item.contributors)) {
        item.contributors.forEach((contributor: any) => {
          if (contributor.login) {
            contributorSet.add(contributor.login);
          }
        });
      }
    });

    return Array.from(contributorSet);
  } catch (error) {
    console.error('Error fetching contributors, using mock data as fallback:', error);
    const mockData = generateMockData(50);
    const contributorSet = new Set<string>();

    mockData.forEach(item => {
      if (item.contributors && Array.isArray(item.contributors)) {
        item.contributors.forEach(contributor => {
          if (contributor.login) {
            contributorSet.add(contributor.login);
          }
        });
      }
    });

    return Array.from(contributorSet);
  }
}
