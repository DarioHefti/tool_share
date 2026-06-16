package models

import "time"

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type Tool struct {
	ID             string   `json:"id"`
	OwnerID        string   `json:"ownerId"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Category       string   `json:"category"`
	SharedToGroups []string `json:"sharedToGroups"`
}

type Group struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	CreatedBy   string   `json:"createdBy"`
	InviteCode  string   `json:"inviteCode"`
	MemberIDs   []string `json:"memberIds"`
}

type BorrowRequest struct {
	ID          string    `json:"id"`
	ToolID      string    `json:"toolId"`
	RequesterID string    `json:"requesterId"`
	OwnerID     string    `json:"ownerId"`
	GroupID     string    `json:"groupId"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	Message     *string   `json:"message,omitempty"`
}

type GroupDetail struct {
	Group
	SharedTools []Tool `json:"sharedTools"`
}
