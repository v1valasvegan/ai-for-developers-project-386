package http

import (
	"encoding/json"
	"net/http"
)

func writeJSON(writer http.ResponseWriter, statusCode int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(statusCode)
	_ = json.NewEncoder(writer).Encode(payload)
}

func writeError(writer http.ResponseWriter, statusCode int, code string, message string) {
	writeJSON(writer, statusCode, map[string]string{
		"error":   code,
		"message": message,
	})
}
