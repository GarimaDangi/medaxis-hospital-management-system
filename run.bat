@echo off
title MEDAXIS - Hospital Management System (Admin Portal)
echo ======================================================================
echo           MEDAXIS - SMART HOSPITAL MANAGEMENT SYSTEM
echo ======================================================================
echo Starting MEDAXIS Clinical Admin Server...
echo Portal URL: http://127.0.0.1:5000
echo.

IF EXIST "C:\Users\thega\anaconda3\python.exe" (
    start http://127.0.0.1:5000
    "C:\Users\thega\anaconda3\python.exe" app.py
) ELSE (
    start http://127.0.0.1:5000
    python app.py
)

pause
