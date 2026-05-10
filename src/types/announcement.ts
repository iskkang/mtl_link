export interface AnnouncementAuthor {
  id:         string
  name:       string | null
  avatar_url: string | null
  is_admin:   boolean
}

export interface AnnouncementItem {
  id:         string
  content:    string
  created_at: string
  updated_at: string | null
  room_id:    string
  author:     AnnouncementAuthor | null
  is_pinned:  boolean
}

export interface AnnouncementRoom {
  id:              string
  name:            string
  is_announcement: true
}
