---
name: deploy
description: Guides deployment processes including pre-deploy checks, deployment strategies, rollback procedures, and post-deploy verification. Use when deploying to staging or production, setting up deployment pipelines, or troubleshooting deployment issues.
---

# Deployment

## Pre-Deploy Checklist

- [ ] All tests pass on the branch being deployed
- [ ] Code reviewed and approved
- [ ] No known critical bugs in the diff
- [ ] Database migrations tested (if any)
- [ ] Environment variables / secrets configured for target environment
- [ ] Monitoring and alerting in place
- [ ] Rollback plan documented
- [ ] Team notified of deployment

## Deployment Strategies

### Rolling Deploy
Replace instances one at a time. Old and new versions run simultaneously during rollout.
- **Pro**: Zero downtime, simple
- **Con**: Must handle two versions running at once (API compatibility, DB schema)
- **Use when**: Changes are backward-compatible

### Blue-Green Deploy
Run two identical environments. Switch traffic from blue (old) to green (new) all at once.
- **Pro**: Instant rollback (switch back to blue), clean cut
- **Con**: Requires double infrastructure during deploy
- **Use when**: You need guaranteed instant rollback

### Canary Deploy
Route a small percentage of traffic (1-5%) to the new version. Gradually increase if healthy.
- **Pro**: Limits blast radius, real production validation
- **Con**: More complex routing, must monitor per-version metrics
- **Use when**: High-risk changes, large user base

### Recreate
Stop old version, start new version. Simplest possible deploy.
- **Pro**: No version compatibility issues, simple
- **Con**: Downtime during switchover
- **Use when**: Maintenance window is acceptable, internal tools

## Deploy Steps

```
1. PREPARE
   - Build production artifact
   - Run smoke tests against artifact
   - Verify configuration for target environment

2. DEPLOY
   - Apply database migrations (if any, BEFORE new code)
   - Deploy new code using chosen strategy
   - Monitor for errors during rollout

3. VERIFY
   - Health check endpoints responding
   - Key user flows working (smoke test)
   - Error rate not elevated
   - Latency within normal range
   - No new error types in logs

4. CONFIRM or ROLLBACK
   - If healthy: mark deploy as successful
   - If unhealthy: execute rollback plan immediately
```

## Rollback

### When to Rollback
- Error rate spikes above baseline
- Health checks failing
- Key user flows broken
- Performance degradation beyond acceptable threshold

### How to Rollback
1. Deploy the previous known-good version (don't try to fix forward under pressure)
2. If database migrations were applied: run the down migration FIRST, then rollback code
3. Verify service is healthy after rollback
4. Investigate root cause at leisure, not under incident pressure

### Migrations and Rollback
- **Forward-compatible migrations**: New columns nullable, old columns still present
- **Never drop columns** in the same deploy as the code change
- **Backfill data** in a separate step from schema change
- If a migration can't be rolled back: mark this in the deploy plan and increase monitoring

## Post-Deploy

- [ ] Verify key flows working on production
- [ ] Check error monitoring for new errors
- [ ] Check performance metrics
- [ ] Update deployment log / changelog
- [ ] Close related tickets
- [ ] Monitor for 15-30 min before moving on
