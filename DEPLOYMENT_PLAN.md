# 🚀 Production Deployment Plan - ML Ecosystem Microservices

## 📋 Overview

Este plan detalla la estrategia de deployment para producción del ecosistema de microservicios ML, diseñado para manejar millones de requests por minuto con alta disponibilidad.

## 🎯 Infrastructure Requirements

### **Minimum Production Setup**
- **CPU**: 8 cores total across services
- **RAM**: 16GB total
- **Storage**: 100GB SSD 
- **Network**: 1Gbps bandwidth
- **Database**: PostgreSQL 14+ (managed service recommended)
- **Cache**: Redis 6+ (managed service recommended)
- **Message Queue**: Kafka 3+ (managed service recommended)

### **Recommended Production Setup**
- **CPU**: 24 cores total (auto-scaling)
- **RAM**: 64GB total
- **Storage**: 500GB SSD with backup
- **Network**: 10Gbps bandwidth
- **Load Balancer**: Multi-AZ with health checks
- **CDN**: For static assets and API caching

## 🏗️ Deployment Architecture

### **Option 1: Kubernetes (Recommended)**
```yaml
# Complete K8s deployment with:
- Horizontal Pod Autoscaler (HPA)
- Vertical Pod Autoscaler (VPA)
- Network Policies
- Service Mesh (Istio)
- Monitoring Stack (Prometheus/Grafana)
```

### **Option 2: Docker Swarm**
```yaml
# Simpler orchestration for smaller teams
- Multi-node Docker Swarm
- Service scaling
- Rolling updates
- Health checks
```

### **Option 3: Cloud Native (AWS/GCP/Azure)**
```yaml
# Fully managed services
- AWS EKS / GCP GKE / Azure AKS
- Managed databases
- Managed caching
- Managed message queues
```

## 📊 Service Scaling Strategy

### **Integration Service** (Critical Path)
```yaml
Replicas: 3-10 (auto-scale)
Resources:
  CPU: 1-2 cores per replica
  RAM: 2-4GB per replica
Triggers:
  - CPU > 70%
  - Memory > 80%
  - Request rate > 1000/min per pod
  - ML API response time > 500ms
```

### **User Service**
```yaml
Replicas: 2-5 (auto-scale)
Resources:
  CPU: 0.5-1 core per replica
  RAM: 1-2GB per replica
Triggers:
  - Authentication rate > 500/min per pod
  - Database connections > 80%
```

### **Analytics Service**
```yaml
Replicas: 2-8 (auto-scale)
Resources:
  CPU: 1-2 cores per replica
  RAM: 2-4GB per replica
Triggers:
  - Event processing rate > 10,000/min per pod
  - Kafka lag > 1000 messages
```

## 🗄️ Database Strategy

### **PostgreSQL (Primary Database)**
```sql
-- Production Configuration
shared_preload_libraries = 'pg_stat_statements'
max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 64MB
maintenance_work_mem = 1GB
wal_buffers = 64MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1

-- Indexes for performance
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_users_ml_user_id ON users(ml_user_id);
CREATE INDEX CONCURRENTLY idx_users_created_at ON users(created_at);
```

### **Redis (Caching Layer)**
```redis
# Production Redis Configuration
maxmemory 8gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
tcp-keepalive 300
timeout 300
```

### **MongoDB (Catalog Service)**
```javascript
// Replica Set Configuration
rs.initiate({
  _id: "ml-ecosystem-rs",
  members: [
    { _id: 0, host: "mongo1:27017", priority: 2 },
    { _id: 1, host: "mongo2:27017", priority: 1 },
    { _id: 2, host: "mongo3:27017", priority: 1, arbiterOnly: true }
  ]
});

// Indexes for performance
db.products.createIndex({ "ml_item_id": 1 }, { unique: true });
db.products.createIndex({ "user_id": 1, "created_at": -1 });
db.products.createIndex({ "category_id": 1, "available_quantity": 1 });
```

## 🔧 Configuration Management

### **Environment Variables**
```bash
# Production Environment Variables
NODE_ENV=production
LOG_LEVEL=info

# MercadoLibre API
ML_CLIENT_ID=${ML_CLIENT_ID}
ML_CLIENT_SECRET=${ML_CLIENT_SECRET}
ML_REDIRECT_URI=https://api.yourdomain.com/api/auth/ml/callback

# Rate Limiting (Production Limits)
GLOBAL_RATE_LIMIT_PER_HOUR=50000
USER_RATE_LIMIT_PER_HOUR=5000
ML_API_RATE_LIMIT_PER_HOUR=45000

# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=10
CIRCUIT_BREAKER_RECOVERY_TIMEOUT=60000

# Database URLs
DATABASE_URL=postgresql://user:pass@postgres:5432/ml_ecosystem
REDIS_URL=redis://redis:6379/0
MONGODB_URL=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/ml_ecosystem

# Kafka
KAFKA_BROKERS=kafka1:9092,kafka2:9092,kafka3:9092

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

### **Secrets Management**
```yaml
# Use Kubernetes Secrets or HashiCorp Vault
apiVersion: v1
kind: Secret
metadata:
  name: ml-ecosystem-secrets
type: Opaque
stringData:
  ML_CLIENT_SECRET: "your-ml-client-secret"
  JWT_SECRET: "your-jwt-secret"
  DATABASE_PASSWORD: "your-db-password"
```

## 🔄 CI/CD Pipeline

### **GitHub Actions Workflow**
```yaml
name: Deploy ML Ecosystem
on:
  push:
    branches: [main]
    
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Tests
        run: |
          npm run test:all
          npm run test:integration
          npm run security:scan
          
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker Images
        run: |
          docker build -t ml-ecosystem/user-service:${{ github.sha }} ./services/user-service
          docker build -t ml-ecosystem/integration-service:${{ github.sha }} ./services/integration-service
          
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/user-service user-service=ml-ecosystem/user-service:${{ github.sha }}
          kubectl set image deployment/integration-service integration-service=ml-ecosystem/integration-service:${{ github.sha }}
          kubectl rollout status deployment/user-service
          kubectl rollout status deployment/integration-service
```

## 📊 Monitoring & Alerting

### **Key Metrics to Monitor**
```yaml
Business Metrics:
  - ml_api_requests_total
  - user_registrations_total
  - oauth_connections_total
  - product_updates_total

Performance Metrics:
  - http_request_duration_seconds
  - circuit_breaker_state
  - rate_limit_utilization
  - cache_hit_ratio

Infrastructure Metrics:
  - container_cpu_usage_percent
  - container_memory_usage_bytes
  - database_connections_active
  - kafka_consumer_lag
```

### **Critical Alerts**
```yaml
- name: High Error Rate
  condition: error_rate > 5% for 2 minutes
  action: PagerDuty + Slack

- name: Circuit Breaker Open
  condition: circuit_breaker_state == "OPEN" for 5 minutes
  action: PagerDuty + Auto-scale

- name: Rate Limit Critical
  condition: rate_limit_utilization > 90% for 5 minutes
  action: Slack + Scale up

- name: Database Connection Pool Full
  condition: db_connections > 90% for 2 minutes
  action: PagerDuty + Scale database
```

## 🚀 Deployment Steps

### **Phase 1: Infrastructure Setup**
```bash
# 1. Set up Kubernetes cluster
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmaps.yaml

# 2. Deploy supporting services
kubectl apply -f k8s/postgresql.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/kafka.yaml
kubectl apply -f k8s/monitoring.yaml

# 3. Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=postgresql --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis --timeout=300s
kubectl wait --for=condition=ready pod -l app=kafka --timeout=300s
```

### **Phase 2: Application Deployment**
```bash
# 1. Deploy services with rolling update
kubectl apply -f k8s/user-service.yaml
kubectl apply -f k8s/integration-service.yaml
kubectl apply -f k8s/catalog-service.yaml
kubectl apply -f k8s/analytics-service.yaml

# 2. Deploy API Gateway
kubectl apply -f k8s/nginx.yaml
kubectl apply -f k8s/ingress.yaml

# 3. Verify deployments
kubectl get pods -l app=ml-ecosystem
kubectl get services
kubectl get ingress
```

### **Phase 3: Verification & Testing**
```bash
# 1. Health checks
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/api/user-service/health
curl https://api.yourdomain.com/api/integration-service/health

# 2. Load testing
npm run performance:test:production

# 3. Monitoring setup verification
open https://grafana.yourdomain.com
open https://prometheus.yourdomain.com
```

## 🔄 Rollback Strategy

### **Zero-Downtime Rollback**
```bash
# Quick rollback to previous version
kubectl rollout undo deployment/user-service
kubectl rollout undo deployment/integration-service

# Rollback to specific revision
kubectl rollout undo deployment/user-service --to-revision=3

# Monitor rollback
kubectl rollout status deployment/user-service
```

### **Database Rollback**
```sql
-- Database migrations rollback
-- Keep numbered migration files for easy rollback
npm run migrate:rollback -- --steps=1
```

## 🔐 Security Considerations

### **Network Security**
```yaml
# Network Policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ml-ecosystem-network-policy
spec:
  podSelector:
    matchLabels:
      app: ml-ecosystem
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
```

### **SSL/TLS Configuration**
```bash
# Use cert-manager for automatic SSL certificates
kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Configure Let's Encrypt issuer
kubectl apply -f k8s/letsencrypt-issuer.yaml
```

## 💰 Cost Optimization

### **Resource Optimization**
```yaml
# Use resource requests and limits
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi

# Enable cluster autoscaler
kubectl apply -f k8s/cluster-autoscaler.yaml
```

### **Cost Monitoring**
```bash
# Use Kubernetes cost monitoring tools
kubectl apply -f https://raw.githubusercontent.com/kubecost/cost-analyzer-helm-chart/develop/kubecost.yaml
```

## 📈 Performance Optimization

### **Caching Strategy**
```javascript
// Multi-level caching
1. Application Level: In-memory cache (Node.js)
2. Service Level: Redis cache
3. CDN Level: CloudFlare/AWS CloudFront
4. Database Level: PostgreSQL query cache
```

### **Database Optimization**
```sql
-- Query optimization
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';

-- Index monitoring
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename = 'users';
```

## 🔍 Troubleshooting Guide

### **Common Issues**
```bash
# Pod stuck in Pending state
kubectl describe pod <pod-name>
kubectl get events --sort-by=.metadata.creationTimestamp

# Service discovery issues
kubectl get endpoints
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup <service-name>

# Database connection issues
kubectl logs <pod-name> | grep -i database
kubectl exec -it <postgres-pod> -- psql -U postgres -d ml_ecosystem
```

### **Performance Issues**
```bash
# Check resource usage
kubectl top pods
kubectl top nodes

# Check application metrics
curl https://api.yourdomain.com/metrics

# Database performance
kubectl exec -it postgres-pod -- psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

## 📋 Post-Deployment Checklist

- [ ] All health checks passing
- [ ] Monitoring dashboards configured
- [ ] Alerts configured and tested
- [ ] SSL certificates valid
- [ ] DNS records configured
- [ ] Load testing completed
- [ ] Backup strategy implemented
- [ ] Documentation updated
- [ ] Team trained on new system
- [ ] Runbook created for operations

## 🚨 Emergency Procedures

### **Complete System Failure**
```bash
# 1. Check cluster status
kubectl get nodes
kubectl get pods --all-namespaces

# 2. Scale up critical services
kubectl scale deployment user-service --replicas=5
kubectl scale deployment integration-service --replicas=8

# 3. Enable maintenance mode
kubectl apply -f k8s/maintenance-page.yaml
```

### **ML API Rate Limit Exceeded**
```bash
# 1. Check rate limit status
curl https://api.yourdomain.com/api/ml/health

# 2. Scale down non-critical requests
kubectl patch deployment integration-service -p '{"spec":{"template":{"spec":{"containers":[{"name":"integration-service","env":[{"name":"RATE_LIMIT_MODE","value":"conservative"}]}]}}}}'

# 3. Implement circuit breaker
kubectl patch deployment integration-service -p '{"spec":{"template":{"spec":{"containers":[{"name":"integration-service","env":[{"name":"CIRCUIT_BREAKER_ENABLED","value":"true"}]}]}}}}'
```

---

## 💡 Success Metrics

### **Technical KPIs**
- **Uptime**: > 99.9%
- **Response Time**: P99 < 500ms
- **Error Rate**: < 0.1%
- **Throughput**: > 10,000 requests/minute

### **Business KPIs**
- **User Conversion**: OAuth completion rate > 95%
- **API Reliability**: ML API success rate > 99%
- **Cost Efficiency**: < $0.01 per 1000 requests
- **Time to Market**: Deploy in < 30 minutes

---

**Built for Scale, Designed for Reliability** 🚀