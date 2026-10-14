# Example project

Authorize this folder in **Projects** to try ORBIT safely. It contains a harmless fake secret so you can see exclusion and redaction work.

To see exclusion in action, create a file named `.env` here containing `DEMO_SECRET=fake`. It will not appear in the file list and cannot be read through ORBIT. (It is not shipped because `.env` files are git-ignored.)
