#!/bin/bash
# Cybernetic Deployment Helper Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Cybernetic Deployment Script ===${NC}\n"

# Detect platform
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  PLATFORM="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  PLATFORM="macos"
else
  PLATFORM="windows"
fi

# Check prerequisites
check_docker() {
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Please install Docker.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Docker found${NC}"
}

check_docker_compose() {
  if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Docker Compose found${NC}"
}

check_node() {
  if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js 20+.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Node.js found${NC}"
}

check_pnpm() {
  if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠ pnpm not found. Installing...${NC}"
    npm install -g pnpm
  fi
  echo -e "${GREEN}✓ pnpm found${NC}"
}

# Setup environment
setup_env() {
  if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please update .env with your configuration${NC}"
  else
    echo -e "${GREEN}✓ .env already exists${NC}"
  fi
}

# Start services
start_local() {
  echo -e "\n${YELLOW}Starting local services...${NC}"
  docker-compose up -d

  echo -e "\n${GREEN}Services started!${NC}"
  echo -e "Router Console: ${GREEN}http://localhost:3000${NC}"
  echo -e "API Gateway: ${GREEN}http://localhost:3001${NC}"
  echo -e "Prometheus: ${GREEN}http://localhost:9090${NC}"
  echo -e "Grafana: ${GREEN}http://localhost:3100${NC}"
}

# Build Docker images
build_images() {
  echo -e "\n${YELLOW}Building Docker images...${NC}"
  docker-compose build --no-cache
  echo -e "${GREEN}✓ Docker images built${NC}"
}

# Deploy to Kubernetes
deploy_k8s() {
  if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}✗ kubectl not found. Please install kubectl.${NC}"
    exit 1
  fi

  echo -e "\n${YELLOW}Deploying to Kubernetes...${NC}"

  kubectl apply -f k8s/namespace.yml
  kubectl apply -f k8s/configmap.yml
  kubectl apply -f k8s/rbac.yml

  echo -e "${YELLOW}Waiting for databases...${NC}"
  kubectl apply -f k8s/postgres.yml
  kubectl apply -f k8s/redis.yml
  kubectl wait --for=condition=ready pod -l app=postgres -n cybernetic --timeout=300s
  kubectl wait --for=condition=ready pod -l app=redis -n cybernetic --timeout=300s

  echo -e "${YELLOW}Deploying applications...${NC}"
  kubectl apply -f k8s/api-gateway.yml
  kubectl apply -f k8s/router-console.yml
  kubectl apply -f k8s/monitoring.yml

  echo -e "${GREEN}✓ Kubernetes deployment complete${NC}"
  kubectl get svc -n cybernetic
}

# Main menu
show_menu() {
  echo -e "\n${YELLOW}What would you like to do?${NC}"
  echo "1) Check prerequisites"
  echo "2) Setup environment"
  echo "3) Start local services (Docker Compose)"
  echo "4) Build Docker images"
  echo "5) Deploy to Kubernetes"
  echo "6) View logs"
  echo "7) Stop services"
  echo "8) Exit"
  read -p "Enter choice [1-8]: " choice
}

view_logs() {
  echo -e "\n${YELLOW}Which service logs?${NC}"
  echo "1) API Gateway"
  echo "2) Router Console"
  echo "3) PostgreSQL"
  echo "4) Redis"
  echo "5) All"
  read -p "Enter choice [1-5]: " log_choice

  case $log_choice in
    1) docker-compose logs -f api-gateway ;;
    2) docker-compose logs -f router-console ;;
    3) docker-compose logs -f postgres ;;
    4) docker-compose logs -f redis ;;
    5) docker-compose logs -f ;;
  esac
}

stop_services() {
  echo -e "${YELLOW}Stopping services...${NC}"
  docker-compose down
  echo -e "${GREEN}✓ Services stopped${NC}"
}

# Main loop
while true; do
  show_menu
  case $choice in
    1)
      echo -e "\n${YELLOW}Checking prerequisites...${NC}"
      check_docker
      check_docker_compose
      check_node
      check_pnpm
      ;;
    2)
      setup_env
      ;;
    3)
      start_local
      ;;
    4)
      build_images
      ;;
    5)
      deploy_k8s
      ;;
    6)
      view_logs
      ;;
    7)
      stop_services
      ;;
    8)
      echo -e "${GREEN}Goodbye!${NC}"
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid choice${NC}"
      ;;
  esac
done
