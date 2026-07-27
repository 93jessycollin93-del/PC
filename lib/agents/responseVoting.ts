/**
 * Response Voting System — Rate and rank AI responses
 * Persist favorites, build "best answers" collection
 */

export interface ResponseVote {
    experimentId: string;
    agentId: string;
    rating: number; // 1-5 stars
    isFavorite: boolean;
    notes?: string;
    votedAt: Date;
}

export interface VotingStats {
    agentId: string;
    agentName: string;
    totalVotes: number;
    averageRating: number;
    favoriteCount: number;
    winRate: number; // % of experiments where this agent was voted best
}

const VOTING_STORAGE_KEY = 'cross_ai_lab_votes';

/**
 * Save vote for a response
 */
export const saveVote = (vote: ResponseVote) => {
    if (typeof window === 'undefined') return;

    const votes = getVotes();
    const key = `${vote.experimentId}_${vote.agentId}`;

    // Update or add vote
    const votesArray = Array.from(votes.values());
    const existingIdx = votesArray.findIndex(v => `${v.experimentId}_${v.agentId}` === key);

    if (existingIdx >= 0) {
        votesArray[existingIdx] = vote;
    } else {
        votesArray.push(vote);
    }

    // Store in localStorage
    const serialized = votesArray.map(v => ({
        ...v,
        votedAt: v.votedAt.toISOString(),
    }));

    localStorage.setItem(VOTING_STORAGE_KEY, JSON.stringify(serialized));
};

/**
 * Get all votes
 */
export const getVotes = (): Map<string, ResponseVote> => {
    if (typeof window === 'undefined') return new Map();

    const data = localStorage.getItem(VOTING_STORAGE_KEY);
    if (!data) return new Map();

    try {
        const votes = JSON.parse(data);
        const map = new Map<string, ResponseVote>();

        votes.forEach((v: any) => {
            const key = `${v.experimentId}_${v.agentId}`;
            map.set(key, {
                ...v,
                votedAt: new Date(v.votedAt),
            });
        });

        return map;
    } catch (e) {
        console.error('Failed to load votes', e);
        return new Map();
    }
};

/**
 * Get vote for specific response
 */
export const getVote = (experimentId: string, agentId: string): ResponseVote | undefined => {
    const votes = getVotes();
    return votes.get(`${experimentId}_${agentId}`);
};

/**
 * Get votes for experiment
 */
export const getExperimentVotes = (experimentId: string): ResponseVote[] => {
    const votes = getVotes();
    return Array.from(votes.values()).filter(v => v.experimentId === experimentId);
};

/**
 * Get favorite responses across all experiments
 */
export const getFavorites = (): ResponseVote[] => {
    const votes = getVotes();
    return Array.from(votes.values()).filter(v => v.isFavorite);
};

/**
 * Calculate voting stats for agent
 */
export const calculateAgentStats = (agentId: string, agentName: string): VotingStats => {
    const votes = getVotes();
    const agentVotes = Array.from(votes.values()).filter(v => v.agentId === agentId);

    if (agentVotes.length === 0) {
        return {
            agentId,
            agentName,
            totalVotes: 0,
            averageRating: 0,
            favoriteCount: 0,
            winRate: 0,
        };
    }

    const totalVotes = agentVotes.length;
    const averageRating = agentVotes.reduce((sum, v) => sum + v.rating, 0) / totalVotes;
    const favoriteCount = agentVotes.filter(v => v.isFavorite).length;

    // Win rate: % of experiments where this agent had highest rating
    let wins = 0;
    const experimentIds = new Set(agentVotes.map(v => v.experimentId));

    experimentIds.forEach(expId => {
        const expVotes = Array.from(votes.values()).filter(v => v.experimentId === expId);
        if (expVotes.length === 0) return;

        const thisAgentVote = expVotes.find(v => v.agentId === agentId);
        const maxRating = Math.max(...expVotes.map(v => v.rating || 0));

        if (thisAgentVote && thisAgentVote.rating === maxRating) {
            wins++;
        }
    });

    const winRate = (wins / experimentIds.size) * 100;

    return {
        agentId,
        agentName,
        totalVotes,
        averageRating: Math.round(averageRating * 10) / 10,
        favoriteCount,
        winRate: Math.round(winRate),
    };
};

/**
 * Get leaderboard of agents by average rating
 */
export const getLeaderboard = (agents: Array<{ id: string; name: string }>): VotingStats[] => {
    const stats = agents.map(agent => calculateAgentStats(agent.id, agent.name));
    return stats
        .filter(s => s.totalVotes > 0)
        .sort((a, b) => b.averageRating - a.averageRating);
};

/**
 * Export votes as JSON
 */
export const exportVotes = (): string => {
    const votes = getVotes();
    return JSON.stringify(Array.from(votes.values()), null, 2);
};

/**
 * Clear all votes (dangerous!)
 */
export const clearAllVotes = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(VOTING_STORAGE_KEY);
    }
};
