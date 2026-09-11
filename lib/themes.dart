import 'package:flutter/material.dart';

const Color primaryColor = Color(0xFF426B54);
const Color secondaryColor = Color(0xFF315440);
const Color accentColor = Color(0xFF426B54);
const Color alternateColor = Color(0xFFE7ECDD);
const Color fadedBlackColor = Color(0xFF252E28);
const Color mutedColor = Color(0xFF687169);
const Color canvasColor = Color(0xFFF7F8F2);
const Color borderColor = Color(0xFFE3E6DC);
Color? errorColor = Colors.red[700];
const fontFamilyWorkSans = 'WorkSans';
const fontFamilyOpenSans = 'OpenSans';
const fontFamilyDefault = fontFamilyOpenSans;
const fontWeightExtraLight = FontWeight.w200;
const fontWeightLight = FontWeight.w300;
const fontWeightNormal = FontWeight.w400;
const fontWeightMedium = FontWeight.w500;
const fontWeightSemiBold = FontWeight.w600;
const fontWeightBold = FontWeight.w700;
const double fontSizeMedium = 16;
const double fontSizeFootnote = 12;
const double fontSizeTiny = 10;
const double fontSizeIconButtonText = 12;
const double fontSizeBrand = 26;

ThemeData theme() => ThemeData(
      useMaterial3: true,
      fontFamily: fontFamilyDefault,
      scaffoldBackgroundColor: canvasColor,
      primaryColor: primaryColor,
      dividerColor: borderColor,
      colorScheme: ColorScheme.fromSeed(seedColor: primaryColor).copyWith(
          primary: primaryColor,
          secondary: accentColor,
          surface: Colors.white,
          error: errorColor),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(fontSize: 16, color: fadedBlackColor),
        bodyMedium: TextStyle(fontSize: 16, color: fadedBlackColor),
        titleLarge:
            TextStyle(color: fadedBlackColor, fontWeight: FontWeight.bold),
      ),
      iconTheme: const IconThemeData(color: accentColor, size: 24),
      appBarTheme: const AppBarTheme(
          backgroundColor: canvasColor,
          foregroundColor: fadedBlackColor,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          centerTitle: false),
      outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              side: const BorderSide(color: borderColor))),
      inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
    );
