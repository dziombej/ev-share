#Application ev-share
I need to create an application for certification in 10xdevs. Requirements are:
-Access control mechanism appropriate for the type of application (e.g. a login screen)
-Data management — creating, reading, updating, and deleting items (CRUD) in a way that makes sense for the application's domain
-Business logic (with or without AI - OpenRouter is just one option for integration)
-Context documents (e.g. prd.md, infrastructure.md, roadmap.md)
-Tests — at least one test verifying the behavior from the user's perspective (e2e)

Tech stack - the same as in project ../flats-manager - you can read it
It has to be as small as possible to fulfill all requirements. 

What is is about:
# application is for EV car users / owners who have its own electric power (230V socket, garage, charger or so). The goal is to share power with other EV users who need it. The application allows to share power with other users, and also to find available power sources nearby. It is a platform for sharing energy between EV owners.
Use case: EV user charge own car at home - no records.
Ev user A charge own car at other's B POC (point of charge) - other user B mark in application that charged car A for example with 10Kwh. 
So user A has its account balance -10kwh, and user B has +10kwh. 
User B can use energy of user's C - so if uses 10kwh from C, then B has +0kwh and C has +10kwh.
So it is only about account balance. Owner of POC mark who used charger and how much energy was used.
Each user has its own account balance.
Each user can see its own account balance and history of transactions.
Each user has details about POC with location, power, and availability.
User can mark its own POC as available or not available.
User can register with email and password, and login to the application - no email confirmation is needed.
User can see all available POC and see if it is available. 
There is nothing about the money, just power exchange. 
Landing page of user contains information about its own account balance, history of transactions, and list of available POC with details.
