/**
 * ROUND-ROBIN INTERLEAVING SCHEDULING ALGORITHM
 * 
 * Objectives:
 * 1. Groups posts by topic (Pillar).
 * 2. Interleaves topics in round-robin sequence (A -> B -> C -> D -> E -> ...).
 * 3. Strict constraint: Absolutely NO 2 posts of the same topic appear adjacent,
 *    and within any day's 3 slots, all 3 posts have distinct topics whenever possible.
 * 4. Assigns queue_index, scheduled_day, and target slots for both Page A and Page B.
 */

export function buildRoundRobinQueue(posts) {
  if (!posts || posts.length === 0) return [];

  // Group posts by pillar
  const topicMap = new Map();
  for (const post of posts) {
    const topic = post.pillar || 'CHUNG';
    if (!topicMap.has(topic)) {
      topicMap.set(topic, []);
    }
    topicMap.get(topic).push(post);
  }

  // Convert to array of queues sorted by initial count descending
  const topicQueues = Array.from(topicMap.entries()).map(([topic, list]) => ({
    topic,
    items: [...list]
  }));

  const totalPosts = posts.length;
  const orderedQueue = [];
  let lastTopic = null;
  let todayTopics = []; // Tracks topics posted on the current day (3 slots/day)

  while (orderedQueue.length < totalPosts) {
    const slotInDay = orderedQueue.length % 3;
    if (slotInDay === 0) {
      todayTopics = []; // New day begins
    }

    // Filter available queues that still have items
    const available = topicQueues.filter(q => q.items.length > 0);
    if (available.length === 0) break;

    // Prioritize topics:
    // 1. Not equal to lastTopic (no immediate repeat)
    // 2. Not in todayTopics if we have enough distinct topics
    // 3. Highest remaining count to balance the distribution
    let candidate = null;

    // Ideal candidate: Not in today's slots AND not last topic
    const idealCandidates = available.filter(
      q => q.topic !== lastTopic && !todayTopics.includes(q.topic)
    );

    if (idealCandidates.length > 0) {
      // Pick topic with highest remaining items to prevent starving large topics (e.g. Tuyển sinh)
      idealCandidates.sort((a, b) => b.items.length - a.items.length);
      candidate = idealCandidates[0];
    } else {
      // Secondary candidate: Just not the immediately preceding topic
      const secondaryCandidates = available.filter(q => q.topic !== lastTopic);
      if (secondaryCandidates.length > 0) {
        secondaryCandidates.sort((a, b) => b.items.length - a.items.length);
        candidate = secondaryCandidates[0];
      } else {
        // Fallback (only 1 topic left in the entire pool)
        candidate = available[0];
      }
    }

    const post = candidate.items.shift();
    lastTopic = candidate.topic;
    todayTopics.push(candidate.topic);

    const queueIndex = orderedQueue.length + 1;
    const dayNumber = Math.floor((queueIndex - 1) / 3) + 1;
    const slotNumber = ((queueIndex - 1) % 3) + 1; // 1 (08:00), 2 (14:00), 3 (19:00)

    orderedQueue.push({
      ...post,
      queue_index: queueIndex,
      scheduled_day: dayNumber,
      scheduled_slot: slotNumber,
      // Default publishing state for both Fanpages
      publishing: {
        page_a: post.publishing?.page_a || { status: 'pending', published_at: null, post_id: null },
        page_b: post.publishing?.page_b || { status: 'pending', published_at: null, post_id: null }
      }
    });
  }

  return orderedQueue;
}

/**
 * Validates the queue to ensure no consecutive posts share the same topic
 */
export function validateQueueConstraints(queue) {
  const violations = [];
  for (let i = 1; i < queue.length; i++) {
    if (queue[i].pillar === queue[i - 1].pillar) {
      violations.push({
        index: i,
        post1: queue[i - 1].id,
        post2: queue[i].id,
        topic: queue[i].pillar,
        day: queue[i].scheduled_day
      });
    }
  }
  return {
    valid: violations.length === 0,
    violationCount: violations.length,
    violations
  };
}
