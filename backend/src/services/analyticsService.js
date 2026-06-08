const { logger } = require('../middleware');
const credentialService = require('./credentialService');

class AnalyticsService {
  constructor() {
    this.cachePrefix = 'analytics:';
    this.cacheTTL = 300; // 5 minutes
  }

  /**
   * Get overall credential usage statistics
   */
  async getCredentialUsageStats(timeRange = '30d') {
    try {
      const cacheKey = `${this.cachePrefix}usage:${timeRange}`;
      
      // Get all credentials
      const allCredentials = await credentialService.getCredentials({}, { limit: 1000, sortBy: 'issued', sortOrder: 'desc' });
      
      // Filter by time range
      const filteredCredentials = this.filterByTimeRange(allCredentials, timeRange);
      
      // Calculate statistics
      const stats = {
        total: filteredCredentials.length,
        byType: this.groupByCredentialType(filteredCredentials),
        byIssuer: this.groupByIssuer(filteredCredentials),
        byStatus: this.groupByStatus(filteredCredentials),
        timeline: this.generateTimelineData(filteredCredentials, timeRange),
        verificationRate: this.calculateVerificationRate(filteredCredentials)
      };
      
      return stats;
    } catch (error) {
      logger.error('Error fetching credential usage stats:', error);
      throw error;
    }
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(timeRange = '30d') {
    try {
      const allCredentials = await credentialService.getCredentials({}, { limit: 1000 });
      const filteredCredentials = this.filterByTimeRange(allCredentials, timeRange);
      
      const stats = {
        totalVerifications: filteredCredentials.length,
        successful: filteredCredentials.filter(c => !c.revoked && (!c.expires || new Date(c.expires) > new Date())).length,
        failed: filteredCredentials.filter(c => c.revoked || (c.expires && new Date(c.expires) < new Date())).length,
        byReason: this.groupByFailureReason(filteredCredentials),
        byType: this.groupVerificationByType(filteredCredentials),
        averageResponseTime: this.calculateAverageResponseTime(filteredCredentials),
        timeline: this.generateVerificationTimeline(filteredCredentials, timeRange)
      };
      
      return stats;
    } catch (error) {
      logger.error('Error fetching verification stats:', error);
      throw error;
    }
  }

  /**
   * Get issuer-specific analytics
   */
  async getIssuerAnalytics(issuerId, timeRange = '30d') {
    try {
      const issuerCredentials = await credentialService.getCredentials(
        { issuer: issuerId },
        { limit: 1000, sortBy: 'issued', sortOrder: 'desc' }
      );
      
      const filteredCredentials = this.filterByTimeRange(issuerCredentials, timeRange);
      
      const stats = {
        issuerId,
        totalIssued: filteredCredentials.length,
        byType: this.groupByCredentialType(filteredCredentials),
        byStatus: this.groupByStatus(filteredCredentials),
        verificationRate: this.calculateVerificationRate(filteredCredentials),
        revocationRate: this.calculateRevocationRate(filteredCredentials),
        topSubjects: this.getTopSubjects(filteredCredentials, 10),
        timeline: this.generateTimelineData(filteredCredentials, timeRange)
      };
      
      return stats;
    } catch (error) {
      logger.error('Error fetching issuer analytics:', error);
      throw error;
    }
  }

  /**
   * Get credential type analytics
   */
  async getCredentialTypeAnalytics(credentialType, timeRange = '30d') {
    try {
      const typeCredentials = await credentialService.getCredentials(
        { credentialType },
        { limit: 1000, sortBy: 'issued', sortOrder: 'desc' }
      );
      
      const filteredCredentials = this.filterByTimeRange(typeCredentials, timeRange);
      
      const stats = {
        credentialType,
        total: filteredCredentials.length,
        byIssuer: this.groupByIssuer(filteredCredentials),
        byStatus: this.groupByStatus(filteredCredentials),
        verificationRate: this.calculateVerificationRate(filteredCredentials),
        averageValidityPeriod: this.calculateAverageValidityPeriod(filteredCredentials),
        timeline: this.generateTimelineData(filteredCredentials, timeRange)
      };
      
      return stats;
    } catch (error) {
      logger.error('Error fetching credential type analytics:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard analytics
   */
  async getDashboardAnalytics(timeRange = '30d') {
    try {
      const [usageStats, verificationStats] = await Promise.all([
        this.getCredentialUsageStats(timeRange),
        this.getVerificationStats(timeRange)
      ]);
      
      const allCredentials = await credentialService.getCredentials({}, { limit: 1000 });
      const filteredCredentials = this.filterByTimeRange(allCredentials, timeRange);
      
      return {
        overview: {
          totalCredentials: usageStats.total,
          totalVerifications: verificationStats.totalVerifications,
          verificationSuccessRate: verificationStats.totalVerifications > 0 
            ? (verificationStats.successful / verificationStats.totalVerifications * 100).toFixed(2)
            : 0,
          activeCredentials: usageStats.byStatus.active || 0,
          revokedCredentials: usageStats.byStatus.revoked || 0
        },
        usage: usageStats,
        verification: verificationStats,
        topIssuers: this.getTopIssuers(filteredCredentials, 5),
        topCredentialTypes: this.getTopCredentialTypes(filteredCredentials, 5),
        recentActivity: this.getRecentActivity(filteredCredentials, 10)
      };
    } catch (error) {
      logger.error('Error fetching dashboard analytics:', error);
      throw error;
    }
  }

  // Helper methods

  filterByTimeRange(credentials, timeRange) {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    return credentials.filter(c => new Date(c.issued) >= startDate);
  }

  groupByCredentialType(credentials) {
    const groups = {};
    credentials.forEach(c => {
      const type = c.credentialType || 'unknown';
      groups[type] = (groups[type] || 0) + 1;
    });
    return groups;
  }

  groupByIssuer(credentials) {
    const groups = {};
    credentials.forEach(c => {
      const issuer = this.shortenLABS(c.issuer);
      groups[issuer] = (groups[issuer] || 0) + 1;
    });
    return groups;
  }

  groupByStatus(credentials) {
    const now = new Date();
    const status = {
      active: 0,
      revoked: 0,
      expired: 0
    };
    
    credentials.forEach(c => {
      if (c.revoked) {
        status.revoked++;
      } else if (c.expires && new Date(c.expires) < now) {
        status.expired++;
      } else {
        status.active++;
      }
    });
    
    return status;
  }

  groupByFailureReason(credentials) {
    const reasons = {
      revoked: 0,
      expired: 0,
      notFound: 0,
      other: 0
    };
    
    credentials.forEach(c => {
      if (c.revoked) {
        reasons.revoked++;
      } else if (c.expires && new Date(c.expires) < new Date()) {
        reasons.expired++;
      } else {
        reasons.other++;
      }
    });
    
    return reasons;
  }

  groupVerificationByType(credentials) {
    const groups = {};
    credentials.forEach(c => {
      const type = c.credentialType || 'unknown';
      if (!groups[type]) {
        groups[type] = { total: 0, successful: 0, failed: 0 };
      }
      groups[type].total++;
      if (!c.revoked && (!c.expires || new Date(c.expires) > new Date())) {
        groups[type].successful++;
      } else {
        groups[type].failed++;
      }
    });
    return groups;
  }

  calculateVerificationRate(credentials) {
    if (credentials.length === 0) return 0;
    const valid = credentials.filter(c => !c.revoked && (!c.expires || new Date(c.expires) > new Date())).length;
    return (valid / credentials.length * 100).toFixed(2);
  }

  calculateRevocationRate(credentials) {
    if (credentials.length === 0) return 0;
    const revoked = credentials.filter(c => c.revoked).length;
    return (revoked / credentials.length * 100).toFixed(2);
  }

  calculateAverageResponseTime(credentials) {
    // Mock implementation - in production, this would track actual verification times
    return Math.random() * 500 + 100; // 100-600ms
  }

  calculateAverageValidityPeriod(credentials) {
    const validCredentials = credentials.filter(c => c.expires);
    if (validCredentials.length === 0) return 0;
    
    const totalDays = validCredentials.reduce((sum, c) => {
      const issued = new Date(c.issued);
      const expires = new Date(c.expires);
      const days = (expires - issued) / (24 * 60 * 60 * 1000);
      return sum + days;
    }, 0);
    
    return Math.round(totalDays / validCredentials.length);
  }

  generateTimelineData(credentials, timeRange) {
    const timeline = [];
    const now = new Date();
    let startDate;
    let interval;
    let format;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = 'day';
        format = 'MMM d';
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        interval = 'day';
        format = 'MMM d';
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        interval = 'week';
        format = 'MMM d';
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        interval = 'month';
        format = 'MMM yyyy';
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        interval = 'day';
        format = 'MMM d';
    }
    
    // Group credentials by time interval
    const grouped = {};
    credentials.forEach(c => {
      const date = new Date(c.issued);
      let key;
      
      if (interval === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (interval === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (interval === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      grouped[key] = (grouped[key] || 0) + 1;
    });
    
    // Generate timeline entries
    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      let key;
      if (interval === 'day') {
        key = currentDate.toISOString().split('T')[0];
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (interval === 'week') {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        key = weekStart.toISOString().split('T')[0];
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (interval === 'month') {
        key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      timeline.push({
        date: key,
        count: grouped[key] || 0
      });
    }
    
    return timeline;
  }

  generateVerificationTimeline(credentials, timeRange) {
    // Similar to timelineData but for verifications
    return this.generateTimelineData(credentials, timeRange);
  }

  getTopIssuers(credentials, limit) {
    const issuerCounts = this.groupByIssuer(credentials);
    return Object.entries(issuerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([issuer, count]) => ({ issuer, count }));
  }

  getTopCredentialTypes(credentials, limit) {
    const typeCounts = this.groupByCredentialType(credentials);
    return Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  getTopSubjects(credentials, limit) {
    const subjectCounts = {};
    credentials.forEach(c => {
      const subject = this.shortenLABS(c.subject);
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });
    
    return Object.entries(subjectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([subject, count]) => ({ subject, count }));
  }

  getRecentActivity(credentials, limit) {
    return credentials
      .sort((a, b) => new Date(b.issued) - new Date(a.issued))
      .slice(0, limit)
      .map(c => ({
        id: c.id,
        type: c.credentialType,
        issuer: this.shortenLABS(c.issuer),
        subject: this.shortenLABS(c.subject),
        issued: c.issued,
        status: c.revoked ? 'revoked' : (c.expires && new Date(c.expires) < new Date() ? 'expired' : 'active')
      }));
  }

  shortenLABS(LABS) {
    if (!LABS) return 'unknown';
    if (LABS.length <= 20) return LABS;
    return `${LABS.substring(0, 10)}...${LABS.substring(LABS.length - 8)}`;
  }
}

module.exports = new AnalyticsService();
