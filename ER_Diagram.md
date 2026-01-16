# Simple ER Diagram for Leave Management System

## Main Entities:
- **Users**: System users with roles (admin, staff, etc.)
- **Departments**: Academic departments
- **Hostels**: Residential hostels
- **Faculty**: Teaching and non-teaching staff
- **Leaves**: Leave records for faculty
- **Leave_Details**: Additional details for leaves

## Key Relationships:
- Departments and Hostels contain Users and Faculty
- Faculty apply for Leaves
- Each Leave can have detailed information

## Simple Text Diagram:

```
Departments ───┬── Users
               │
               └── Faculty ─── Leaves ─── Leave_Details

Hostels ───────┬── Users
               │
               └── Faculty
```

## PlantUML Code for Simple Diagram:

```plantuml
@startuml Simple ER Diagram
entity "Departments" as dept {
  * department_id
  --
  department_name
}

entity "Hostels" as hostel {
  * hostel_id
  --
  hostel_name
}

entity "Users" as users {
  * id
  --
  username
  role
}

entity "Faculty" as faculty {
  * id
  --
  faculty_name
  designation
  total_leaves
}

entity "Leaves" as leaves {
  * id
  --
  faculty_id
  leave_date
  leave_category
}

entity "Leave_Details" as details {
  * id
  --
  leave_id
  details
}

' Relationships
dept ||--o{ users : belongs_to
dept ||--o{ faculty : belongs_to
hostel ||--o{ users : belongs_to
hostel ||--o{ faculty : belongs_to
faculty ||--o{ leaves : applies
leaves ||--|| details : has
@enduml
```
