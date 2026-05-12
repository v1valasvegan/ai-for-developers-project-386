package service

import "errors"

var (
	ErrBadRequest = errors.New("bad request")
	ErrNotFound   = errors.New("not found")
	ErrConflict   = errors.New("conflict")
)
