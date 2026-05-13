package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	transport "github.com/v1valasvegan/ai-for-developers-project-386/backend/internal/http"
	"github.com/v1valasvegan/ai-for-developers-project-386/backend/internal/service"
	"github.com/v1valasvegan/ai-for-developers-project-386/backend/internal/storage"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("APP_PORT")
	}
	if port == "" {
		port = "3000"
	}

	frontendDist := os.Getenv("FRONTEND_DIST")
	if frontendDist == "" {
		frontendDist = filepath.Join("frontend", "dist")
	}

	store := storage.NewMemory()
	svc := service.New(store)
	router := transport.NewRouter(svc, frontendDist)

	addr := ":" + port
	log.Printf("backend listening on %s", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatal(err)
	}
}
