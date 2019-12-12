import 'package:dingn/models/account.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';

class UserProfilePage extends StatefulWidget {
  const UserProfilePage({this.account});
  final Account account;

  @override
  _UserProfileState createState() => _UserProfileState(account);
}

class _UserProfileState extends State<UserProfilePage>
    with SingleTickerProviderStateMixin {
  _UserProfileState(this.account);
  bool _status = true;
  final FocusNode myFocusNode = FocusNode();
  final Account account;
  final userNamePattern = RegExp(r'^[a-z0-9_-]{3,15}$');
  String userValidationError;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        body: Container(
      color: Colors.white,
      child: ListView(
        children: <Widget>[
          Column(
            children: <Widget>[
              Container(
                height: 250.0,
                color: Colors.white,
                child: Column(
                  children: <Widget>[
                    Padding(
                      padding: const EdgeInsets.only(top: 20.0),
                      child: Stack(fit: StackFit.loose, children: <Widget>[
                        // Row(
                        //   crossAxisAlignment: CrossAxisAlignment.center,
                        //   mainAxisAlignment: MainAxisAlignment.center,
                        //   children: <Widget>[
                        //     Container(
                        //         width: 140.0,
                        //         height: 140.0,
                        //         decoration: const BoxDecoration(
                        //           shape: BoxShape.circle,
                        //           image: DecorationImage(
                        //             image: ExactAssetImage(
                        //                 'assets/images/as.png'),
                        //             fit: BoxFit.cover,
                        //           ),
                        //         )),
                        //   ],
                        // ),
                        Padding(
                            padding: const EdgeInsets.only(top: 90.0, right: 100.0),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: <Widget>[
                                CircleAvatar(
                                  backgroundColor: Colors.red,
                                  radius: 50.0,
                                  backgroundImage: NetworkImage(account.photoURL),
                                )
                              ],
                            )),
                      ]),
                    )
                  ],
                ),
              ),
              Container(
                color: const Color(0xffFFFFFF),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 25.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.start,
                    children: <Widget>[
                      Padding(
                          padding: const EdgeInsets.only(
                              left: 25.0, right: 25.0, top: 25.0),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            mainAxisSize: MainAxisSize.max,
                            children: <Widget>[
                              Column(
                                mainAxisAlignment: MainAxisAlignment.end,
                                mainAxisSize: MainAxisSize.min,
                                children: <Widget>[
                                  _status ? _getEditIcon() : Container(),
                                ],
                              )
                            ],
                          )),
                      Padding(
                          padding: const EdgeInsets.only(
                              left: 25.0, right: 25.0, top: 25.0),
                          child: Row(
                            mainAxisSize: MainAxisSize.max,
                            children: <Widget>[
                              Column(
                                mainAxisAlignment: MainAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: <Widget>[
                                  Text(
                                    'UserName(*)',
                                    style: TextStyle(
                                        fontSize: 16.0,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ],
                          )),
                      Padding(
                          padding: const EdgeInsets.only(
                              left: 25.0, right: 25.0, top: 2.0),
                          child: Row(
                            mainAxisSize: MainAxisSize.max,
                            children: <Widget>[
                              Flexible(
                                child: TextField(
                                  controller: TextEditingController()..text = account.userName,
                                  decoration: InputDecoration(
                                    hintText: 'Enter Your UserName (Used As Display Name)',
                                    errorText: userValidationError,
                                  ),
                                  enabled: !_status,
                                  autofocus: !_status,
                                  onSubmitted: (newValue){
                                    newValue = newValue.trim();
                                    if(!userNamePattern.hasMatch(newValue)||newValue.length>10||newValue.isEmpty){
                                      setState(() {
                                        userValidationError = 'Invalid user name format';
                                      });
                                    }
                                  },
                                  
                                ),
                              ),
                            ],
                          )),
                      // Padding(
                      //     padding: const EdgeInsets.only(
                      //         left: 25.0, right: 25.0, top: 25.0),
                      //     child: Row(
                      //       mainAxisSize: MainAxisSize.max,
                      //       children: <Widget>[
                      //         Column(
                      //           mainAxisAlignment: MainAxisAlignment.start,
                      //           mainAxisSize: MainAxisSize.min,
                      //           children: <Widget>[
                      //             Text(
                      //               'Full Name',
                      //               style: TextStyle(
                      //                   fontSize: 16.0,
                      //                   fontWeight: FontWeight.bold),
                      //             ),
                      //           ],
                      //         ),
                      //       ],
                      //     )),
                      // Padding(
                      //     padding: const EdgeInsets.only(
                      //         left: 25.0, right: 25.0, top: 2.0),
                      //     child: Row(
                      //       mainAxisSize: MainAxisSize.max,
                      //       children: <Widget>[
                      //         Flexible(
                      //           child: TextField(
                      //             decoration: const InputDecoration(
                      //                 hintText: 'Enter Your Full Name'),
                      //             enabled: !_status,
                      //           ),
                      //         ),
                      //       ],
                      //     )),
                      Padding(
                          padding: const EdgeInsets.only(
                              left: 25.0, right: 25.0, top: 25.0),
                          child: Row(
                            mainAxisSize: MainAxisSize.max,
                            children: <Widget>[
                              Column(
                                mainAxisAlignment: MainAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: <Widget>[
                                  Text(
                                    'Bio',
                                    style: TextStyle(
                                        fontSize: 16.0,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ],
                          )),
                      Padding(
                          padding: const EdgeInsets.only(
                              left: 25.0, right: 25.0, top: 2.0),
                          child: Row(
                            mainAxisSize: MainAxisSize.max,
                            children: <Widget>[
                              Flexible(
                                child: TextField(
                                  decoration: const InputDecoration(
                                      hintText: 'Add a bio'),
                                  enabled: !_status,
                                ),
                              ),
                            ],
                          )),
                      Padding(
                          padding: const EdgeInsets.only(
                              left: 25.0, right: 25.0, top: 25.0),
                          child: Row(
                            mainAxisSize: MainAxisSize.max,
                            mainAxisAlignment: MainAxisAlignment.start,
                            children: <Widget>[
                              Expanded(
                                child: Container(
                                  child: Text(
                                    'Occupation',
                                    style: TextStyle(
                                        fontSize: 16.0,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ),
                                flex: 2,
                              ),
                              Expanded(
                                child: Container(
                                  child: Text(
                                    'Location',
                                    style: TextStyle(
                                        fontSize: 16.0,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ),
                                flex: 2,
                              ),
                            ],
                          )),
                      Padding(
                          padding: const EdgeInsets.only(
                              left: 25.0, right: 25.0, top: 2.0),
                          child: Row(
                            mainAxisSize: MainAxisSize.max,
                            mainAxisAlignment: MainAxisAlignment.start,
                            children: <Widget>[
                              Flexible(
                                child: Padding(
                                  padding: const EdgeInsets.only(right: 10.0),
                                  child: TextField(
                                    decoration: const InputDecoration(
                                        hintText: 'Enter Occupation'),
                                    enabled: !_status,
                                  ),
                                ),
                                flex: 2,
                              ),
                              Flexible(
                                child: TextField(
                                  decoration: const InputDecoration(
                                      hintText: 'Enter Location'),
                                  enabled: !_status,
                                ),
                                flex: 2,
                              ),
                            ],
                          )),
                      !_status ? _getActionButtons() : Container(),
                    ],
                  ),
                ),
              )
            ],
          ),
        ],
      ),
    ));
  }

  @override
  void dispose() {
    // Clean up the controller when the Widget is disposed
    myFocusNode.dispose();
    super.dispose();
  }

  Widget _getActionButtons() {
    return Padding(
      padding: const EdgeInsets.only(left: 25.0, right: 25.0, top: 45.0),
      child: Row(
        mainAxisSize: MainAxisSize.max,
        mainAxisAlignment: MainAxisAlignment.start,
        children: <Widget>[
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 10.0),
              child: Container(
                  child: RaisedButton(
                child: const Text('Save'),
                textColor: Colors.white,
                color: Colors.green,
                onPressed: () {
                  setState(() {
                    _status = true;
                    FocusScope.of(context).requestFocus(FocusNode());
                  });
                },
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20.0)),
              )),
            ),
            flex: 2,
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 10.0),
              child: Container(
                  child: RaisedButton(
                child: const Text('Cancel'),
                textColor: Colors.white,
                color: Colors.red,
                onPressed: () {
                  setState(() {
                    _status = true;
                    FocusScope.of(context).requestFocus(FocusNode());
                  });

                },
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20.0)),
              )),
            ),
            flex: 2,
          ),
        ],
      ),
    );
  }

  Widget _getEditIcon() {
    return GestureDetector(
      child: CircleAvatar(
        backgroundColor: Colors.red,
        radius: 14.0,
        child: Icon(
          Icons.edit,
          color: Colors.white,
          size: 16.0,
        ),
      ),
      onTap: () {
        setState(() {
          _status = false;
        });
      },
    );
  }
}