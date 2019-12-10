import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';

class PanelItem {
  PanelItem({
    this.expandedValue,
    this.headerValue,
    this.isExpanded = false,
  });

  String expandedValue;
  String headerValue;
  bool isExpanded;
}

List<PanelItem> generateItem(String header, String content) {
  return List.generate(1, (int index) {
    return PanelItem(
      headerValue: header,
      expandedValue: content,
    );
  });
}

class Expanel extends StatefulWidget {
  const Expanel({Key key, this.header, this.content}) : super(key: key);
  final String header;
  final String content;

  @override
  _ExpanelState createState() => _ExpanelState(header, content);
}

class _ExpanelState extends State<Expanel>{
  _ExpanelState(String header, String content){
    data = generateItem(header, content);
  } 
  List<PanelItem> data;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
    child: Container(
      child: _buildPanel(),
    ),
  );
  }

  Widget _buildPanel() {
  return ExpansionPanelList(
    expansionCallback: (int index, bool isExpanded) {
      setState(() {
        data[index].isExpanded = !isExpanded;
      });
    },
    children: data.map<ExpansionPanel>((PanelItem item) {
      return ExpansionPanel(
        headerBuilder: (BuildContext context, bool isExpanded) {
          return ListTile(
            title: Text(
              item.headerValue, textAlign: TextAlign.center,
              style: const TextStyle(color: AppTheme.accentColor, fontWeight: FontWeight.bold))
          );
        },
        body: 
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Text(item.expandedValue, style: TextStyle(color: AppTheme.fadedBlackColor, fontWeight: FontWeight.normal)), 
            ),
        isExpanded: item.isExpanded,
      );
    }).toList(),
  );
}
}
