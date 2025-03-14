import 'package:flutter/material.dart';

const Color primaryColor = Color.fromRGBO(84, 197, 248, 1);
const Color secondaryColor = Color.fromRGBO(1, 87, 155, 1);
const Color accentColor = Color.fromRGBO(255, 86, 120, 1);
const Color alternateColor = Color.fromRGBO(255, 224, 116, 1);
const Color fadedBlackColor = Color.fromRGBO(32, 33, 36, 1);
Color? errorColor = Colors.red[300];

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
const double fontSizeFootnote = 10;
const double fontSizeTiny = 6;
const double fontSizeIconButtonText = 12;
const double fontSizeBrand = 20;

ThemeData theme() {
  final theme = ThemeData(
    primaryColor: primaryColor,
    buttonTheme: const ButtonThemeData(textTheme: ButtonTextTheme.normal),
    dividerColor: accentColor,
    colorScheme: ColorScheme.fromSwatch().copyWith(
      secondary: accentColor,
      error: errorColor,
    ),
    // scaffoldBackgroundColor: Colors.grey[100],
    textTheme: const TextTheme(
      // displayLarge: TextStyle(
      //   fontSize: 28,
      //   fontFamily: fontFamilyWorkSans,
      // ),
      // titleLarge: TextStyle(
      //   fontFamily: fontFamilyWorkSans
      // ),
      bodyLarge: TextStyle(
        fontSize: fontSizeMedium,
      ),
      bodyMedium: TextStyle(
        fontSize: fontSizeMedium,
      ),
      labelLarge: TextStyle(
        fontSize: fontSizeMedium,
      ),
    ),
    fontFamily: fontFamilyDefault,
    primaryIconTheme: const IconThemeData(
      color: accentColor,
      size: 30,
    ),
    iconTheme: const IconThemeData(
      color: accentColor,
      size: 30,
    ),
  );
  return theme.copyWith(
      colorScheme: theme.colorScheme.copyWith(secondary: accentColor));
}
